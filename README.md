# VeriFlo

Compliant asset distribution on Stellar with reusable zero-knowledge
eligibility credentials.

VeriFlo lets an issuer verify eligibility without collecting user identity
documents. A KYC provider issues a portable credential, the user generates a
wallet-bound Groth16 proof, and Soroban contracts enforce nullifier replay
protection plus VFLY authorization.

## MVP Surface

- **Investor:** connect Freighter or the demo wallet, load a credential,
  generate a wallet-bound proof, submit it, and receive VFLY.
- **Issuer:** publish policy inputs, stage a demo distribution reserve, and
  generate a browser-local demo credential.
- **Audit:** inspect root registration, reserve staging, proof verification,
  nullifier use, and release events without exposing identity fields.
- **Execution modes:** Demo mode is the judge-safe browser flow. Testnet mode
  uses deployed Soroban contracts and refuses demo proof bytes.

## Current Architecture

```text
KYC credential
  -> snarkjs Groth16 proof
KYC verifier contract
  -> Protocol 25 BN254 pairing check
VeriFlo verifier contract
  -> trusted root + nullifier + wallet binding
VFLY token
  -> verifier-controlled authorization and mint
```

The current MVP uses a Soroban token controlled by the verifier contract. The
classic Stellar `AUTH_REQUIRED` plus claimable balance rail remains the next
production integration step.

## Hackathon Demo

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`, leave the mode switch on **Demo**, then run:

1. **Demo wallet**
2. **Issuer** -> **Generate demo credential** -> **Save to wallet**
3. **Investor** -> **Verify and receive VFLY**
4. **Audit** -> show the compliance event stream

Expected result: the wallet shows `1000.0000000` VFLY, the audit stream records
the proof release, and a second claim is rejected.

## Local Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

`npm run dev` copies the circuit WASM and zkey into `frontend/public/circuits`
before starting Next.js.

The app defaults to Demo mode even when testnet contract IDs are present. Use
the **Testnet** mode switch when you want to submit real circuit proofs to the
deployed verifier.

## Testnet Environment

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_TOKEN_CONTRACT=C...
NEXT_PUBLIC_KYC_VERIFIER_CONTRACT=C...
NEXT_PUBLIC_VERIFIER_CONTRACT=C...

# Optional server-only faucet. Keep disabled unless explicitly needed.
ENABLE_TESTNET_FUNDER=false
# ISSUER_SECRET=S...
```

Never prefix secrets with `NEXT_PUBLIC_`, and never commit `.env.local`.

## Deploy Contracts

```bash
SOURCE=deployer TRUSTED_ROOT_HEX=<32-byte-root-hex> ./scripts/deploy.sh
```

If `TRUSTED_ROOT_HEX` is omitted, deployment succeeds but no credential root is
trusted until `add_trusted_root` is called.

## Verification

```bash
cargo test
cd frontend
npm test
npm run build
```
