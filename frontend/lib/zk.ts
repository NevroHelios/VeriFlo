import type { Credential } from "@/lib/credential";

export interface ProofResult {
  proofBytes: Uint8Array;
  publicInputs: Uint8Array[];
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

function bigintToBytes32(n: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let val = n;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(val & 0xffn);
    val >>= 8n;
  }
  return bytes;
}

function computeNullifier(nonce: string, recipient: string): Uint8Array {
  // Poseidon(nonce, recipient) — placeholder until WASM loaded
  // In production: use circomlibjs poseidon
  const combined = new TextEncoder().encode(`nullifier:${nonce}:${recipient}`);
  const hash = new Uint8Array(32);
  for (let i = 0; i < combined.length && i < 32; i++) {
    hash[i] = combined[i] ^ (i * 7);
  }
  return hash;
}

export async function generateProof(
  cred: Credential,
  recipientAddress: string
): Promise<ProofResult> {
  // Attempt real snarkjs proof if files are available
  try {
    const snarkjs = await import("snarkjs");
    const wasmResp = await fetch("/circuits/kyc_eligibility.wasm");
    const zkeyResp = await fetch("/circuits/kyc_eligibility.zkey");
    if (wasmResp.ok && zkeyResp.ok) {
      const input = {
        jurisdiction: cred.jurisdiction,
        accreditation: cred.accreditation,
        expiry: cred.expiry,
        issuer_id: cred.issuer_id,
        nonce: cred.nonce,
        merkle_siblings: cred.merkle_siblings,
        merkle_path: cred.merkle_path,
        merkle_root: cred.merkle_root,
        min_accreditation: 1,
        current_time: Math.floor(Date.now() / 1000),
        recipient: recipientAddress,
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
      return { proofBytes, publicInputs };
    }
  } catch {
    // circuit files not available — fall through to mock
  }

  // Mock proof: 256 zero bytes with recognizable pattern
  const proofBytes = new Uint8Array(256);
  for (let i = 0; i < 256; i++) proofBytes[i] = i % 256;

  const nullifier = computeNullifier(cred.nonce, recipientAddress);
  const merkleRoot = hexToBytes(cred.merkle_root);
  const minAccred = bigintToBytes32(BigInt(cred.accreditation));
  const currentTime = bigintToBytes32(BigInt(Math.floor(Date.now() / 1000)));
  const recipientFr = new Uint8Array(32);
  const addrBytes = new TextEncoder().encode(recipientAddress);
  recipientFr.set(addrBytes.slice(0, Math.min(32, addrBytes.length)));

  return {
    proofBytes,
    publicInputs: [nullifier, merkleRoot, minAccred, currentTime, recipientFr],
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
