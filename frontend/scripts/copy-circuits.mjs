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

let copied = 0;
for (const artifact of artifacts) {
  if (!existsSync(artifact.from)) {
    console.warn(`[circuits] Missing artifact (testnet ZK unavailable): ${artifact.from}`);
    continue;
  }
  copyFileSync(artifact.from, artifact.to);
  copied++;
}

if (copied === artifacts.length) {
  console.log(`[circuits] Prepared ${copied} circuit artifacts in ${publicDir}`);
} else {
  console.warn(`[circuits] ${copied}/${artifacts.length} artifacts copied — demo mode only`);
}
