/**
 * verify-credential.js
 * Walks the credential's commitment up the tree using the merkle siblings/path
 * and checks the result matches the embedded merkle_root.
 *
 * If this fails, the credential is malformed and proof generation will fail.
 *
 * Usage: node verify-credential.js wallet-credential-G...json
 */
import { buildPoseidon } from "circomlibjs";
import { readFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node verify-credential.js <wallet-credential.json>");
  process.exit(1);
}

const cred = JSON.parse(readFileSync(file, "utf8"));

const poseidon = await buildPoseidon();
const F = poseidon.F;

console.log("── Credential fields ──");
console.log("jurisdiction:  ", cred.jurisdiction);
console.log("accreditation: ", cred.accreditation);
console.log("expiry:        ", cred.expiry);
console.log("issuer_id:     ", cred.issuer_id);
console.log("nonce:         ", cred.nonce);
console.log("merkle_root:   ", cred.merkle_root);
console.log("siblings.len:  ", cred.merkle_siblings.length);
console.log("path.len:      ", cred.merkle_path.length);
console.log();

const commitment = F.toObject(
  poseidon([
    BigInt(cred.jurisdiction),
    BigInt(cred.accreditation),
    BigInt(cred.expiry),
    BigInt(cred.issuer_id),
    BigInt(cred.nonce),
  ])
);
console.log("Computed commitment:", commitment.toString());
console.log();

let current = commitment;
for (let i = 0; i < cred.merkle_siblings.length; i++) {
  const sibling = BigInt(cred.merkle_siblings[i]);
  const pathBit = Number(cred.merkle_path[i]);
  if (pathBit === 0) {
    current = F.toObject(poseidon([current, sibling]));
  } else if (pathBit === 1) {
    current = F.toObject(poseidon([sibling, current]));
  } else {
    console.error(`Bad path bit at index ${i}: ${pathBit} (must be 0 or 1)`);
    process.exit(1);
  }
}

const expected = BigInt(cred.merkle_root);
console.log("Computed root:", current.toString());
console.log("Expected root:", expected.toString());
console.log(current === expected ? "✓ MERKLE PROOF VALID" : "✗ MISMATCH — credential is broken");
process.exit(current === expected ? 0 : 1);
