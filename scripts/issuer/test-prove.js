/**
 * test-prove.js
 * Loads a wallet-credential JSON, builds the snarkjs witness EXACTLY like
 * frontend/lib/zk.ts does, and runs full proof generation server-side.
 *
 * If this fails, the bug is in our witness construction.
 * If this succeeds, the bug is browser-specific (stale wasm, encoding).
 *
 * Usage: node test-prove.js wallet-credential-G...json [STELLAR_ADDRESS]
 *   STELLAR_ADDRESS defaults to a placeholder for nullifier check;
 *   pass the same address you used at issuance to truly mirror zk.ts.
 */
import { buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Address, xdr } from "@stellar/stellar-sdk";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const file = process.argv[2];
const stellarAddress = process.argv[3];
if (!file || !stellarAddress) {
  console.error("Usage: node test-prove.js <wallet-credential.json> <STELLAR_ADDRESS>");
  process.exit(1);
}

const cred = JSON.parse(readFileSync(file, "utf8"));

// ── Mirror zk.ts addressToFieldBytes ────────────────────────────────────────
function addressToFieldBytes(address) {
  const scval = xdr.ScVal.scvAddress(Address.fromString(address).toScAddress());
  const digest = createHash("sha256").update(scval.toXDR()).digest();
  const field = Buffer.alloc(32);
  digest.copy(field, 1, 0, 31); // bytes [1..31] = digest[0..30]
  return field;
}

// ── Mirror zk.ts parseFieldValue / fieldDecimal ─────────────────────────────
function fieldDecimal(value) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return BigInt(value).toString();
  const t = String(value).trim();
  if (!t) return "0";
  if (/^0x[0-9a-f]+$/i.test(t)) return BigInt(t).toString();
  if (/^[0-9]+$/.test(t)) return BigInt(t).toString();
  if (/^[0-9a-f]+$/i.test(t)) return BigInt(`0x${t}`).toString();
  return "0";
}

function bytesToBigint(buf) {
  const hex = Buffer.from(buf).toString("hex");
  return hex ? BigInt(`0x${hex}`) : 0n;
}

const recipientField = addressToFieldBytes(stellarAddress);
const recipientBig = bytesToBigint(recipientField);

const poseidon = await buildPoseidon();
const F = poseidon.F;
const nullifierBig = F.toObject(poseidon([BigInt(cred.nonce), recipientBig]));

const input = {
  jurisdiction: fieldDecimal(cred.jurisdiction),
  accreditation: fieldDecimal(cred.accreditation),
  expiry: fieldDecimal(cred.expiry),
  issuer_id: fieldDecimal(cred.issuer_id),
  nonce: fieldDecimal(cred.nonce),
  merkle_siblings: cred.merkle_siblings.map(fieldDecimal),
  merkle_path: cred.merkle_path,
  nullifier: nullifierBig.toString(),
  merkle_root: fieldDecimal(cred.merkle_root),
  min_accreditation: "1",
  current_time: fieldDecimal(Math.floor(Date.now() / 1000)),
  recipient: recipientBig.toString(),
};

console.log("── Input being passed to snarkjs ──");
console.log(JSON.stringify(input, null, 2));
console.log();

const wasm = resolve(ROOT, "circuits/build/kyc_eligibility_js/kyc_eligibility.wasm");
const zkey = resolve(ROOT, "circuits/build/kyc_eligibility_final.zkey");

console.log("Generating proof...");
try {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);
  console.log("✓ Proof generated successfully");
  console.log("publicSignals:", publicSignals);
} catch (err) {
  console.error("✗ Proof generation failed:", err.message);
  process.exit(1);
}
