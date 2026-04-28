import type { Credential } from "@/lib/credential";
import { Address, xdr } from "@stellar/stellar-sdk";
import { buildPoseidon } from "circomlibjs";

export type ProofMode = "real" | "demo";

export interface ProofResult {
  proofBytes: Uint8Array;
  publicInputs: Uint8Array[];
  mode: ProofMode;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = clean.padStart(64, "0");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bigintToBytes32(n: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let val = n;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(val & 0xffn);
    val >>= 8n;
  }
  return bytes;
}

function bytesToBigint(bytes: Uint8Array): bigint {
  const hex = bytesToHex(bytes);
  return hex ? BigInt(`0x${hex}`) : 0n;
}

function parseFieldValue(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);

  const trimmed = value.trim();
  if (!trimmed) return 0n;
  if (/^0x[0-9a-f]+$/i.test(trimmed)) return BigInt(trimmed);
  if (/^[0-9]+$/.test(trimmed)) return BigInt(trimmed);
  if (/^[0-9a-f]+$/i.test(trimmed)) return BigInt(`0x${trimmed}`);

  return bytesToBigint(textToFieldBytes(trimmed));
}

function fieldDecimal(value: string | number | bigint): string {
  return parseFieldValue(value).toString();
}

function fieldBytes(value: string | number | bigint): Uint8Array {
  return bigintToBytes32(parseFieldValue(value));
}

function textToFieldBytes(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const out = new Uint8Array(32);
  for (let i = 0; i < Math.min(31, bytes.length); i++) {
    out[i + 1] = bytes[i];
  }
  return out;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is not available in this browser.");
  }
  const data = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(data).set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

export async function addressToFieldBytes(address: string): Promise<Uint8Array> {
  const addressScVal = xdr.ScVal.scvAddress(
    Address.fromString(address).toScAddress()
  );
  const digest = await sha256(addressScVal.toXDR());
  const field = new Uint8Array(32);
  field.set(digest.slice(0, 31), 1);
  return field;
}

async function computeNullifier(nonce: string, recipientField: Uint8Array) {
  const poseidon = await buildPoseidon();
  const nonceValue = parseFieldValue(nonce);
  const recipientValue = bytesToBigint(recipientField);
  const hash = poseidon([nonceValue, recipientValue]);
  return bigintToBytes32(BigInt(poseidon.F.toString(hash)));
}

export async function generateProof(
  cred: Credential,
  recipientAddress: string,
  options: { allowDemoProof?: boolean } = {}
): Promise<ProofResult> {
  const allowDemoProof = options.allowDemoProof ?? true;
  const recipientField = await addressToFieldBytes(recipientAddress);

  // Attempt real snarkjs proof if files are available
  try {
    const snarkjs = await import("snarkjs");
    const wasmResp = await fetch("/circuits/kyc_eligibility.wasm");
    const zkeyResp = await fetch("/circuits/kyc_eligibility.zkey");
    if (wasmResp.ok && zkeyResp.ok) {
      const nullifier = await computeNullifier(cred.nonce, recipientField);
      const input = {
        jurisdiction: fieldDecimal(cred.jurisdiction),
        accreditation: fieldDecimal(cred.accreditation),
        expiry: fieldDecimal(cred.expiry),
        issuer_id: fieldDecimal(cred.issuer_id),
        nonce: fieldDecimal(cred.nonce),
        merkle_siblings: cred.merkle_siblings.map(fieldDecimal),
        merkle_path: cred.merkle_path,
        nullifier: bytesToBigint(nullifier).toString(),
        merkle_root: fieldDecimal(cred.merkle_root),
        min_accreditation: "1",
        current_time: fieldDecimal(Math.floor(Date.now() / 1000)),
        recipient: bytesToBigint(recipientField).toString(),
      };
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "/circuits/kyc_eligibility.wasm",
        "/circuits/kyc_eligibility.zkey"
      );

      // Serialize proof: pi_a (64B) + pi_b (128B) + pi_c (64B) = 256B
      const proofBytes = serializeProof(proof);
      const publicInputs = (publicSignals as string[]).map((s: string) =>
        bigintToBytes32(BigInt(s))
      );
      if (bytesToHex(publicInputs[4]) !== bytesToHex(recipientField)) {
        throw new Error("Generated proof is not bound to the connected wallet.");
      }
      return { proofBytes, publicInputs, mode: "real" };
    }
  } catch (err) {
    if (!allowDemoProof) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Real ZK proof unavailable: ${reason}. Run npm run prepare:circuits and use a credential whose Merkle path matches the trusted root.`
      );
    }
  }

  if (!allowDemoProof) {
    throw new Error(
      "Real ZK proof unavailable: circuit WASM/zkey files were not found."
    );
  }

  // Mock proof: 256 zero bytes with recognizable pattern
  const proofBytes = new Uint8Array(256);
  for (let i = 0; i < 256; i++) proofBytes[i] = i % 256;

  const nullifier = await computeNullifier(cred.nonce, recipientField);
  const merkleRoot = hexToBytes(cred.merkle_root);
  const minAccred = fieldBytes(cred.accreditation);
  const currentTime = bigintToBytes32(BigInt(Math.floor(Date.now() / 1000)));

  return {
    proofBytes,
    publicInputs: [nullifier, merkleRoot, minAccred, currentTime, recipientField],
    mode: "demo",
  };
}

function serializeProof(proof: {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}): Uint8Array {
  const buf = new Uint8Array(256);
  const writeG1 = (coords: string[], offset: number) => {
    const x = bigintToBytes32(BigInt(coords[0]));
    const y = bigintToBytes32(BigInt(coords[1]));
    buf.set(x, offset);
    buf.set(y, offset + 32);
  };
  const writeG2 = (coords: string[][], offset: number) => {
    // Soroban G2 encoding: x_im||x_re||y_im||y_re (c1||c0 ordering)
    const x_re = bigintToBytes32(BigInt(coords[0][0]));
    const x_im = bigintToBytes32(BigInt(coords[0][1]));
    const y_re = bigintToBytes32(BigInt(coords[1][0]));
    const y_im = bigintToBytes32(BigInt(coords[1][1]));
    buf.set(x_im, offset);
    buf.set(x_re, offset + 32);
    buf.set(y_im, offset + 64);
    buf.set(y_re, offset + 96);
  };
  writeG1(proof.pi_a, 0);
  writeG2(proof.pi_b, 64);
  writeG1(proof.pi_c, 192);
  return buf;
}
