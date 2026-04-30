/**
 * issue-credential.js
 * Issues a signed ZK credential for a Stellar address.
 * Reads issuer-keypair.json, writes credential-<ADDRESS>.json.
 *
 * Usage:
 *   node issue-credential.js \
 *     --address G... \
 *     --jurisdiction 356 \
 *     --accreditation 1 \
 *     --expiry 1893456000
 */
import { buildPoseidon, buildEddsa, buildBabyjub } from "circomlibjs";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    result[args[i].replace("--", "")] = args[i + 1];
  }
  return result;
}

const args = parseArgs();
const { address, jurisdiction, accreditation, expiry } = args;

if (!address || !jurisdiction || !accreditation || !expiry) {
  console.error("Usage: node issue-credential.js --address G... --jurisdiction <n> --accreditation <n> --expiry <unix_ts>");
  process.exit(1);
}

const keypairPath = resolve(__dirname, "issuer-keypair.json");
if (!existsSync(keypairPath)) {
  console.error("issuer-keypair.json not found. Run generate-keypair.js first.");
  process.exit(1);
}

const keypair = JSON.parse(readFileSync(keypairPath, "utf8"));
const privateKeyBytes = Buffer.from(keypair.privateKey, "hex");

const BN254_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

const poseidon = await buildPoseidon();
const eddsa = await buildEddsa();
const babyJub = await buildBabyjub();
const F = babyJub.F;

// Generate nonce: 31 random bytes as BigInt (always < BN254 field prime)
const nonceBytes = crypto.getRandomValues(new Uint8Array(31));
const nonce = BigInt("0x" + Buffer.from(nonceBytes).toString("hex"));

// Circuit uses issuer_id as a field element; use a numeric ID
const ISSUER_ID = 1001n;

const jn = BigInt(jurisdiction);
const ac = BigInt(accreditation);
const ex = BigInt(expiry);

// commitment = Poseidon(jurisdiction, accreditation, expiry, issuer_id, nonce)
const commitmentHash = poseidon([jn, ac, ex, ISSUER_ID, nonce]);
const commitment = F.toObject(commitmentHash).toString();

// Sign the commitment with EdDSA Poseidon
const sig = eddsa.signPoseidon(privateKeyBytes, commitmentHash);

// Verify immediately
const pubKey = eddsa.prv2pub(privateKeyBytes);
const valid = eddsa.verifyPoseidon(commitmentHash, sig, pubKey);
if (!valid) {
  console.error("Signature verification failed — aborting.");
  process.exit(1);
}

const credential = {
  version: "1",
  recipient: address,
  jurisdiction: Number(jn),
  accreditation: Number(ac),
  expiry: Number(ex),
  issuer_id: ISSUER_ID.toString(),
  nonce: nonce.toString(),
  commitment,
  signature: {
    R8x: F.toObject(sig.R8[0]).toString(),
    R8y: F.toObject(sig.R8[1]).toString(),
    S: sig.S.toString(),
  },
  issuer_public_key: {
    x: keypair.publicKey.x,
    y: keypair.publicKey.y,
  },
};

const outPath = resolve(__dirname, `credential-${address}.json`);
writeFileSync(outPath, JSON.stringify(credential, null, 2));
console.log(`Credential issued and written to ${outPath}`);
console.log("Commitment:", commitment);
