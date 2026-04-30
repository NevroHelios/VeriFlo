/**
 * update-registry.js
 * Reads merkle-root.txt and submits the root to the on-chain credential registry.
 *
 * Usage:
 *   REGISTRY_CONTRACT=C... ADMIN_SECRET=S... node update-registry.js [--root-file <path>]
 */
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

const REGISTRY_CONTRACT = process.env.REGISTRY_CONTRACT;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const RPC_URL = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";

if (!REGISTRY_CONTRACT || !ADMIN_SECRET) {
  console.error("Set REGISTRY_CONTRACT and ADMIN_SECRET environment variables.");
  process.exit(1);
}

const args = process.argv.slice(2);
const fileIdx = args.indexOf("--root-file");
const rootFile = fileIdx !== -1 ? args[fileIdx + 1] : resolve(__dirname, "merkle-root.txt");

const rootDecimalStr = readFileSync(rootFile, "utf8").trim();
const rootBigInt = BigInt(rootDecimalStr);

// Convert decimal BigInt to 32-byte big-endian Buffer
function bigIntToBytes32(n) {
  const hex = n.toString(16).padStart(64, "0");
  return Buffer.from(hex, "hex");
}

const rootBytes = bigIntToBytes32(rootBigInt);
const rootScVal = xdr.ScVal.scvBytes(rootBytes);

const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);
const server = new SorobanRpc.Server(RPC_URL);
const contract = new Contract(REGISTRY_CONTRACT);

console.log("Submitting Merkle root:", rootDecimalStr);
console.log("Root bytes (hex):", rootBytes.toString("hex"));

const account = await server.getAccount(adminKeypair.publicKey());

const tx = new TransactionBuilder(account, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(contract.call("add_root", rootScVal))
  .setTimeout(30)
  .build();

const prepared = await server.prepareTransaction(tx);
prepared.sign(adminKeypair);

const result = await server.sendTransaction(prepared);
console.log("Submitted:", result.hash);

// Poll for confirmation
let status = result.status;
while (status === "PENDING" || status === "NOT_FOUND") {
  await new Promise((r) => setTimeout(r, 2000));
  const check = await server.getTransaction(result.hash);
  status = check.status;
  console.log("Status:", status);
}

if (status === "SUCCESS") {
  console.log("Root registered successfully.");
} else {
  console.error("Transaction failed:", status);
  process.exit(1);
}
