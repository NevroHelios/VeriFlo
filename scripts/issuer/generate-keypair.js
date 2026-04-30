/**
 * generate-keypair.js
 * Generates a BabyJubJub EdDSA keypair for credential issuance.
 * Output: issuer-keypair.json (added to .gitignore — never commit)
 *
 * Usage: node generate-keypair.js
 */
import { buildEddsa, buildBabyjub } from "circomlibjs";
import { writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "issuer-keypair.json");

if (existsSync(OUT_PATH)) {
  console.error("issuer-keypair.json already exists. Delete it first to regenerate.");
  process.exit(1);
}

const eddsa = await buildEddsa();
const babyJub = await buildBabyjub();
const F = babyJub.F;

const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));
const pubKey = eddsa.prv2pub(privateKeyBytes);

const keypair = {
  privateKey: Buffer.from(privateKeyBytes).toString("hex"),
  publicKey: {
    x: F.toObject(pubKey[0]).toString(),
    y: F.toObject(pubKey[1]).toString(),
  },
};

writeFileSync(OUT_PATH, JSON.stringify(keypair, null, 2));
console.log("Issuer keypair written to issuer-keypair.json");
console.log("Public key X:", keypair.publicKey.x);
console.log("Public key Y:", keypair.publicKey.y);
console.log("\nAdd the public key to frontend/constants.ts as ISSUER_PUB_X / ISSUER_PUB_Y.");
console.log("NEVER commit issuer-keypair.json.");
