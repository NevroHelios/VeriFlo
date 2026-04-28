import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const publicDir = resolve(root, "frontend", "public", "circuits");

const artifacts = [
  {
    from: resolve(root, "circuits", "build", "kyc_eligibility_js", "kyc_eligibility.wasm"),
    to: resolve(publicDir, "kyc_eligibility.wasm"),
  },
  {
    from: resolve(root, "circuits", "build", "kyc_eligibility_final.zkey"),
    to: resolve(publicDir, "kyc_eligibility.zkey"),
  },
];

mkdirSync(publicDir, { recursive: true });

for (const artifact of artifacts) {
  if (!existsSync(artifact.from)) {
    throw new Error(`Missing circuit artifact: ${artifact.from}`);
  }
  copyFileSync(artifact.from, artifact.to);
}

console.log(`Prepared ${artifacts.length} circuit artifacts in ${publicDir}`);
