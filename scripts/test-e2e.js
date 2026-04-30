/**
 * test-e2e.js
 * End-to-end ZK integration test: generates a real Groth16 proof, verifies it
 * off-chain with snarkjs, then submits it to the deployed testnet verifier.
 *
 * Prerequisites:
 *   - circuits/build/kyc_eligibility.wasm and .zkey present
 *   - circuits/build/kyc_eligibility_final_verification_key.json present (export with snarkjs)
 *   - Deployed contracts with addresses in environment variables
 *
 * Environment variables:
 *   VERIFIER_CONTRACT  — veriflo-verifier contract address
 *   TEST_SECRET        — Stellar secret key of test user
 *   STELLAR_RPC_URL    — (default: testnet RPC)
 *
 * Usage: node scripts/test-e2e.js
 */
import { buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  Keypair,
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
  Address,
} from "@stellar/stellar-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── helpers ──────────────────────────────────────────────────────────────────

function bigIntToBytes32(n) {
  const hex = n.toString(16).padStart(64, "0");
  return Buffer.from(hex, "hex");
}

function sha256Sync(buf) {
  // Node.js built-in
  const { createHash } = await import("crypto");
  return createHash("sha256").update(buf).digest();
}

async function addressToFieldBytes(address) {
  // Mirrors frontend/lib/zk.ts addressToFieldBytes
  const { Address: SdkAddress, xdr: sdkXdr } = await import("@stellar/stellar-sdk");
  const scval = sdkXdr.ScVal.scvAddress(SdkAddress.fromString(address).toScAddress());
  const { createHash } = await import("crypto");
  const digest = createHash("sha256").update(scval.toXDR()).digest();
  const field = Buffer.alloc(32);
  digest.copy(field, 1, 0, 31); // bytes [1..31] = digest[0..30]; byte 0 stays 0
  return field;
}

function serializeProof(proof) {
  // Mirrors frontend/lib/zk.ts serializeProof (Soroban G2 c1||c0 ordering)
  const buf = Buffer.alloc(256);
  const writeG1 = (coords, offset) => {
    bigIntToBytes32(BigInt(coords[0])).copy(buf, offset);
    bigIntToBytes32(BigInt(coords[1])).copy(buf, offset + 32);
  };
  const writeG2 = (coords, offset) => {
    bigIntToBytes32(BigInt(coords[0][1])).copy(buf, offset);       // x_im
    bigIntToBytes32(BigInt(coords[0][0])).copy(buf, offset + 32);  // x_re
    bigIntToBytes32(BigInt(coords[1][1])).copy(buf, offset + 64);  // y_im
    bigIntToBytes32(BigInt(coords[1][0])).copy(buf, offset + 96);  // y_re
  };
  writeG1(proof.pi_a, 0);
  writeG2(proof.pi_b, 64);
  writeG1(proof.pi_c, 192);
  return buf;
}

// ── test credential ───────────────────────────────────────────────────────────

const VERIFIER_CONTRACT = process.env.VERIFIER_CONTRACT;
const TEST_SECRET = process.env.TEST_SECRET;
const RPC_URL = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";

if (!VERIFIER_CONTRACT || !TEST_SECRET) {
  console.error("Set VERIFIER_CONTRACT and TEST_SECRET environment variables.");
  process.exit(1);
}

const testKeypair = Keypair.fromSecret(TEST_SECRET);
const testAddress = testKeypair.publicKey();

console.log("Test address:", testAddress);

const poseidon = await buildPoseidon();
const F = poseidon.F;

// Minimal single-leaf Merkle tree at depth 20
const TREE_DEPTH = 20;
const jurisdiction = 356n;   // India
const accreditation = 1n;
const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400 * 365); // 1 year
const issuer_id = 1001n;
const nonceBytes = Buffer.alloc(31);
crypto.getRandomValues(nonceBytes);
const nonce = BigInt("0x" + nonceBytes.toString("hex"));

const commitmentHash = poseidon([jurisdiction, accreditation, expiry, issuer_id, nonce]);
const commitment = F.toObject(commitmentHash);

// Build single-leaf Merkle tree
const zero = 0n;
const leaves = new Array(2 ** TREE_DEPTH).fill(zero);
leaves[0] = commitment;

const levels = [leaves.map((l) => l)];
for (let d = 0; d < TREE_DEPTH; d++) {
  const prev = levels[d];
  const next = [];
  for (let i = 0; i < prev.length; i += 2) {
    next.push(F.toObject(poseidon([prev[i], prev[i + 1]])));
  }
  levels.push(next);
}
const merkleRoot = levels[TREE_DEPTH][0];

const pathElements = [];
const pathIndices = [];
let pos = 0;
for (let d = 0; d < TREE_DEPTH; d++) {
  const siblingIdx = pos % 2 === 0 ? pos + 1 : pos - 1;
  pathElements.push(levels[d][siblingIdx].toString());
  pathIndices.push(pos % 2);
  pos = Math.floor(pos / 2);
}

const recipientField = await addressToFieldBytes(testAddress);
const recipientBigInt = BigInt("0x" + recipientField.toString("hex"));

const nullifierHash = poseidon([nonce, recipientBigInt]);
const nullifier = F.toObject(nullifierHash);

const currentTime = BigInt(Math.floor(Date.now() / 1000));

const input = {
  jurisdiction: jurisdiction.toString(),
  accreditation: accreditation.toString(),
  expiry: expiry.toString(),
  issuer_id: issuer_id.toString(),
  nonce: nonce.toString(),
  merkle_siblings: pathElements,
  merkle_path: pathIndices.map(String),
  nullifier: nullifier.toString(),
  merkle_root: merkleRoot.toString(),
  min_accreditation: "1",
  current_time: currentTime.toString(),
  recipient: recipientBigInt.toString(),
};

const wasmFile = resolve(ROOT, "circuits/build/kyc_eligibility_js/kyc_eligibility.wasm");
const zkeyFile = resolve(ROOT, "circuits/build/kyc_eligibility_final.zkey");
const vkeyFile = resolve(ROOT, "circuits/build/kyc_eligibility_final_verification_key.json");

console.log("Generating Groth16 proof (this takes a few seconds)...");
const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmFile, zkeyFile);
console.log("Proof generated.");

// Off-chain verification
const vkey = JSON.parse(readFileSync(vkeyFile, "utf8"));
const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
if (!valid) {
  console.error("Off-chain verification FAILED — proof is invalid.");
  process.exit(1);
}
console.log("Off-chain verification: PASSED");

// Serialize for Soroban
const proofBytes = serializeProof(proof);

// Build public inputs as Vec<BytesN<32>>
const pubInputsScVals = publicSignals.map((s) => {
  const bytes = bigIntToBytes32(BigInt(s));
  return xdr.ScVal.scvBytes(bytes);
});

const server = new SorobanRpc.Server(RPC_URL);
const contract = new Contract(VERIFIER_CONTRACT);
const account = await server.getAccount(testAddress);

const userScVal = xdr.ScVal.scvAddress(Address.fromString(testAddress).toScAddress());
const proofScVal = xdr.ScVal.scvBytes(proofBytes);
const inputsScVal = xdr.ScVal.scvVec(pubInputsScVals);

const tx = new TransactionBuilder(account, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(contract.call("verify_and_authorize", proofScVal, inputsScVal, userScVal))
  .setTimeout(30)
  .build();

const prepared = await server.prepareTransaction(tx);
prepared.sign(testKeypair);

console.log("Submitting proof to testnet verifier...");
const result = await server.sendTransaction(prepared);
console.log("Transaction hash:", result.hash);

let status = result.status;
while (status === "PENDING" || status === "NOT_FOUND") {
  await new Promise((r) => setTimeout(r, 2000));
  const check = await server.getTransaction(result.hash);
  status = check.status;
}

if (status !== "SUCCESS") {
  console.error("Transaction failed:", status);
  process.exit(1);
}
console.log("On-chain verification: PASSED — wallet authorized and VFLY minted.");

// Replay test: same proof should be rejected
console.log("Testing nullifier replay protection...");
const account2 = await server.getAccount(testAddress);
const tx2 = new TransactionBuilder(account2, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(contract.call("verify_and_authorize", proofScVal, inputsScVal, userScVal))
  .setTimeout(30)
  .build();

const prepared2 = await server.prepareTransaction(tx2);
prepared2.sign(testKeypair);
const result2 = await server.sendTransaction(prepared2);

let status2 = result2.status;
while (status2 === "PENDING" || status2 === "NOT_FOUND") {
  await new Promise((r) => setTimeout(r, 2000));
  const check = await server.getTransaction(result2.hash);
  status2 = check.status;
}

if (status2 === "SUCCESS") {
  console.error("Replay attack SUCCEEDED — nullifier replay protection is broken!");
  process.exit(1);
}
console.log("Nullifier replay: correctly rejected.");
console.log("\nAll E2E tests passed.");
