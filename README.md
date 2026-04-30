# VeriFlo

Compliant asset distribution on Stellar with reusable zero-knowledge eligibility credentials.

VeriFlo lets an issuer verify investor eligibility **without** collecting or storing identity documents. A KYC provider issues a portable Merkle credential, the investor generates a wallet-bound Groth16 proof entirely in the browser, and four Soroban contracts enforce nullifier replay protection and VFLY authorization on-chain.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Deployed Contracts](#deployed-contracts)
3. [Quick Demo](#quick-demo)
4. [Project Structure](#project-structure)
5. [Local Development](#local-development)
6. [Issuer Tooling](#issuer-tooling)
7. [Testnet Setup](#testnet-setup)
8. [Deploy Contracts](#deploy-contracts)
9. [Testing](#testing)
10. [Execution Modes](#execution-modes)

---

## Architecture

```
KYC credential (off-chain)
  └─► snarkjs Groth16 proof (browser, ~3 s)
        │
        ├─► KYC Verifier contract
        │     └─► Soroban Protocol 25 BN254 pairing check
        │
        └─► VeriFlo Verifier contract
              ├─► Trusted Merkle root check  (Credential Registry)
              ├─► Nullifier replay guard      (persistent storage)
              ├─► Wallet binding check        (sha256(Address.toXDR())[0..31])
              ├─► Ledger-time expiry check
              └─► VFLY mint on success        (VFLY Token contract)
```

**Public input layout** (must match circuit output order):

| Index | Field | Description |
|-------|-------|-------------|
| 0 | `nullifier` | Poseidon(nonce, recipient) — prevents replay |
| 1 | `merkle_root` | Commitment tree root, verified against registry |
| 2 | `min_accreditation` | Minimum tier required (circuit-enforced) |
| 3 | `current_time` | Unix seconds at proof time (circuit-enforced expiry) |
| 4 | `recipient` | sha256(Address.toXDR())[0..31] — wallet binding |

**Why this design?**
- The proof is generated client-side — the verifier never sees raw PII.
- Nullifiers are stored on-ledger, so the same credential cannot claim twice.
- Merkle roots are published by the issuer to the Credential Registry; revoking a root invalidates all credentials under it without touching user data.
- Storage TTLs are bumped on every write (~30-day lifetime, extend when < 1/5 remains) so contract state survives across ledger periods.

---

## Deployed Contracts (Stellar Testnet)

| Contract | Address |
|---|---|
| VFLY Token | [`CCAQZRNHHCZ7BJ3OHX4DOX3POFPYUOAGE6NQAEJMNKLVX7IBGVPTAM2P`](https://stellar.expert/explorer/testnet/contract/CCAQZRNHHCZ7BJ3OHX4DOX3POFPYUOAGE6NQAEJMNKLVX7IBGVPTAM2P) |
| KYC Verifier (Groth16) | [`CDQ56VSVYUOFIGNBLZSBEQ7ZJL4WVKSJ7RILJNULN4564B4OBZVKWISW`](https://stellar.expert/explorer/testnet/contract/CDQ56VSVYUOFIGNBLZSBEQ7ZJL4WVKSJ7RILJNULN4564B4OBZVKWISW) |
| VeriFlo Verifier | [`CDGGIZWLIC6SWP2WFCENCB5XWJIJVEQLAU3ZX2OL7N6BCMVVEV5ECAV6`](https://stellar.expert/explorer/testnet/contract/CDGGIZWLIC6SWP2WFCENCB5XWJIJVEQLAU3ZX2OL7N6BCMVVEV5ECAV6) |
| Credential Registry | [`CATEWNQ53QS2RLGXDK2MN2F55OIUXSUQCLVUNJ5RX3LCIRFRIQCML6AJ`](https://stellar.expert/explorer/testnet/contract/CATEWNQ53QS2RLGXDK2MN2F55OIUXSUQCLVUNJ5RX3LCIRFRIQCML6AJ) |

All four contracts are deployed and initialized on testnet. Register a trusted Merkle root with `add_trusted_root` on the VeriFlo Verifier before submitting testnet proofs.

---

## Quick Demo

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`, leave the mode switch on **Demo**, then:

1. Click **Demo wallet** (creates an ephemeral in-memory wallet)
2. Go to **Issuer** → **Generate demo credential** → **Save to wallet**
3. Go to **Investor** → **Verify and receive VFLY**
4. Go to **Audit** to see the compliance event stream

Expected result:
- Wallet shows `1000.0000000 VFLY`
- Audit stream records the proof release event
- A second claim attempt is **rejected** (nullifier replay)

> No circuit files are required for Demo mode — a deterministic mock proof is used. A warning banner appears in Testnet mode if `kyc_eligibility.wasm` / `.zkey` are missing.

---

## Project Structure

```
veriflo/
├── contracts/
│   ├── credential-registry/   # Issuer Merkle root registry
│   ├── kyc-verifier/          # Soroban BN254 Groth16 pairing verifier
│   ├── veriflo-verifier/      # Core verifier: root + nullifier + wallet + time + mint
│   └── vfly-token/            # Authorization-gated SPL-style token
├── frontend/
│   ├── app/                   # Next.js App Router pages
│   ├── components/            # React components (AppShell, panels, wallet)
│   ├── hooks/                 # useWallet, useBalance
│   ├── lib/
│   │   └── zk.ts              # snarkjs proof generation + circuit file check
│   └── constants.ts           # Contract addresses, mint amount, env vars
├── scripts/
│   ├── deploy.sh              # Build + deploy + initialize all four contracts
│   ├── test-e2e.js            # End-to-end ZK integration test (real proof → testnet)
│   └── issuer/                # Issuer CLI tools (keypair, credential, registry)
└── Cargo.toml                 # Workspace
```

---

## Local Development

```bash
# Install frontend dependencies
cd frontend
npm install

# Start dev server (also copies circuit files into public/circuits/)
npm run dev
```

Open `http://localhost:3000`. The app starts in **Demo** mode by default.

### Circuit files (Testnet mode only)

Real ZK proof generation requires:

```
frontend/public/circuits/kyc_eligibility.wasm
frontend/public/circuits/kyc_eligibility.zkey
```

`npm run dev` will copy these from `circuits/build/` if present. If they are missing and you switch to Testnet mode, a warning banner is shown in the UI. Demo mode works without them.

---

## Issuer Tooling

The `scripts/issuer/` directory contains Node.js CLI tools for the issuer role.

```bash
cd scripts/issuer
npm install

# 1. Generate an issuer keypair (saved to issuer-keypair.json — gitignored)
node generate-keypair.js

# 2. Issue a credential for a wallet address
node issue-credential.js \
  --address G... \
  --jurisdiction 356 \
  --accreditation 1 \
  --expiry 1893456000

# 3. Build a Merkle tree from all issued credentials
node build-merkle-tree.js

# 4. Publish the Merkle root to the on-chain registry
REGISTRY_CONTRACT=CATE... ADMIN_SECRET=S... node update-registry.js
```

`issuer-keypair.json`, `credential-*.json`, `wallet-credential-*.json`, `merkle-proof-*.json`, and `merkle-tree.json` are all **gitignored** — never commit them.

One-step shortcut:

```bash
# Issue + register in one shot
./scripts/issuer/issue-and-register.sh G... 356 1 1893456000
```

---

## Testnet Setup

Create `frontend/.env.local` from the example:

```bash
cp frontend/.env.local.example frontend/.env.local
```

Fill in the contract addresses:

```bash
NEXT_PUBLIC_TOKEN_CONTRACT=CCAQ...
NEXT_PUBLIC_KYC_VERIFIER_CONTRACT=CDQ5...
NEXT_PUBLIC_VERIFIER_CONTRACT=CDGG...
NEXT_PUBLIC_REGISTRY_CONTRACT=CATE...

# Optional: server-side faucet (keep false unless explicitly needed)
ENABLE_TESTNET_FUNDER=false
# ISSUER_SECRET=S...
```

Never prefix secrets with `NEXT_PUBLIC_`. Never commit `.env.local`.

---

## Deploy Contracts

```bash
SOURCE=deployer TRUSTED_ROOT_HEX=<32-byte-hex> ./scripts/deploy.sh
```

The script builds (via `cargo build --release --target wasm32-unknown-unknown`) and deploys all four contracts, then initializes each one in order:

1. **VFLY Token** — admin = deployer
2. **KYC Verifier** — stateless BN254 pairing checker
3. **VeriFlo Verifier** — admin = deployer, linked to token + KYC verifier
4. **Credential Registry** — admin = deployer, linked to verifier

If `TRUSTED_ROOT_HEX` is omitted, deployment succeeds but no root is trusted until you call `add_trusted_root` manually.

---

## Testing

### Contract unit tests (22 tests)

```bash
cargo test --workspace
```

Tests use Soroban's snapshot-based environment. Snapshots are stored in `test_snapshots/` alongside each contract and are committed for regression detection.

### Frontend type check + build

```bash
cd frontend && npm run build
```

### End-to-end ZK integration test

Generates a real Groth16 proof off-chain, verifies it with snarkjs, then submits it to the deployed testnet verifier contract:

```bash
VERIFIER_CONTRACT=CDGG... TEST_SECRET=S... node scripts/test-e2e.js
```

Requires circuit build artifacts (`wasm`, `zkey`, `verification_key.json`) in `circuits/build/`.

---

## Execution Modes

| Mode | Proof type | Contracts | Use case |
|------|-----------|-----------|----------|
| **Demo** | Deterministic mock bytes | In-memory simulation | Hackathon demo, judge review |
| **Testnet** | Real snarkjs Groth16 | Deployed Soroban contracts | Integration testing, production |

Switch modes with the toggle in the top-right corner of the UI. Testnet mode rejects demo proof bytes at the contract level. The mode is persisted in `localStorage`.
