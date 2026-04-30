/**
 * build-merkle-tree.js
 * Reads all credential-*.json files, builds the Poseidon Merkle tree,
 * writes merkle-tree.json and per-user merkle-proof-<ADDRESS>.json files.
 *
 * Usage: node build-merkle-tree.js [--dir <path>]
 *   --dir  Directory containing credential-*.json files (default: current dir)
 */
import { buildPoseidon } from "circomlibjs";
import { writeFileSync, readdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const dirIdx = args.indexOf("--dir");
const credDir = dirIdx !== -1 ? args[dirIdx + 1] : __dirname;

const TREE_DEPTH = 20; // Must match kyc_eligibility.circom KycEligibility(20)

const poseidon = await buildPoseidon();
const F = poseidon.F;

function poseidon2(a, b) {
  return F.toObject(poseidon([a, b]));
}

// Read all credentials
const files = readdirSync(credDir).filter(
  (f) => f.startsWith("credential-") && f.endsWith(".json")
);

if (files.length === 0) {
  console.error(`No credential-*.json files found in ${credDir}`);
  process.exit(1);
}

const credentials = files.map((f) => {
  const cred = JSON.parse(readFileSync(resolve(credDir, f), "utf8"));
  return { file: f, address: cred.recipient, commitment: BigInt(cred.commitment) };
});

console.log(`Building tree from ${credentials.length} credential(s)...`);

// Pad to 2^TREE_DEPTH leaves with zero
const leafCount = 2 ** TREE_DEPTH;
const leaves = new Array(leafCount).fill(0n);
credentials.forEach((c, i) => {
  leaves[i] = c.commitment;
});

// Build tree bottom-up: levels[0] = leaves, levels[TREE_DEPTH] = [root]
const levels = [leaves.map((l) => l)];
for (let d = 0; d < TREE_DEPTH; d++) {
  const prev = levels[d];
  const next = [];
  for (let i = 0; i < prev.length; i += 2) {
    next.push(poseidon2(prev[i], prev[i + 1]));
  }
  levels.push(next);
}

const root = levels[TREE_DEPTH][0];
console.log("Merkle root:", root.toString());

// Serialise tree as decimal strings
const treeJson = levels.map((level) => level.map((v) => v.toString()));
writeFileSync(resolve(credDir, "merkle-tree.json"), JSON.stringify(treeJson, null, 2));
writeFileSync(resolve(credDir, "merkle-root.txt"), root.toString());

// Hex form (32-byte big-endian) — pass this to `add_trusted_root` on the verifier.
const rootHex = root.toString(16).padStart(64, "0");
writeFileSync(resolve(credDir, "merkle-root.hex"), rootHex);
console.log("Wrote merkle-tree.json, merkle-root.txt, merkle-root.hex");
console.log("Merkle root (hex):", rootHex);

// Write per-user proof files AND a frontend-ready merged credential
credentials.forEach((cred, idx) => {
  const pathElements = [];
  const pathIndices = [];
  let pos = idx;
  for (let d = 0; d < TREE_DEPTH; d++) {
    const siblingIdx = pos % 2 === 0 ? pos + 1 : pos - 1;
    pathElements.push(levels[d][siblingIdx].toString());
    pathIndices.push(pos % 2);
    pos = Math.floor(pos / 2);
  }

  const proofFile = `merkle-proof-${cred.address}.json`;
  writeFileSync(
    resolve(credDir, proofFile),
    JSON.stringify({ address: cred.address, merkle_root: root.toString(), pathElements, pathIndices }, null, 2)
  );

  // Merge the original credential with the merkle proof for direct import
  // by frontend/components/CredentialPanel.tsx (parseCredentialFile schema).
  const original = JSON.parse(readFileSync(resolve(credDir, cred.file), "utf8"));
  const walletCredential = {
    jurisdiction: original.jurisdiction,
    accreditation: original.accreditation,
    expiry: original.expiry,
    issuer_id: original.issuer_id,
    nonce: original.nonce,
    merkle_root: root.toString(),
    merkle_siblings: pathElements,
    merkle_path: pathIndices,
  };
  const walletFile = `wallet-credential-${cred.address}.json`;
  writeFileSync(resolve(credDir, walletFile), JSON.stringify(walletCredential, null, 2));
  console.log(`Wrote ${proofFile} and ${walletFile}`);
});

console.log("");
console.log("Next steps:");
console.log("  1. Convert merkle-root.txt to 32-byte hex for the registry call (see README).");
console.log("  2. Run update-registry.js to publish the root on-chain.");
console.log("  3. Import wallet-credential-<ADDRESS>.json in the Investor panel.");
