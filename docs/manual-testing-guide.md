# VeriFlo Manual Testing Guide

This guide shows how to test VeriFlo as a normal user. It covers the local demo
MVP flow and the testnet contract checks.

## 1. Start The App

From the repo root:

```bash
cd frontend
npm install
npm run dev
```

Expected output:

```text
Prepared 2 circuit artifacts in .../frontend/public/circuits
Local: http://localhost:3000
Ready
```

Open the local URL shown by Next.js.

## 2. Local MVP Happy Path

Use this mode when you want the full product flow without spending testnet XLM.

Before starting the app, temporarily remove or comment these values in
`frontend/.env.local`:

```bash
NEXT_PUBLIC_TOKEN_CONTRACT=
NEXT_PUBLIC_KYC_VERIFIER_CONTRACT=
NEXT_PUBLIC_VERIFIER_CONTRACT=
```

Restart `npm run dev`.

### User Workflow

1. Click **Demo wallet**.
2. Open the **Issuer** tab.
3. Click **Generate demo credential**.
4. Click **Save to wallet**.
5. Open the **Investor** tab.
6. Confirm these checks show as passing:
   - Wallet-bound proof: `Ready`
   - Credential root: `Trusted demo root`
   - Accreditation: `Tier 2`
   - Expiry: future date
7. Click **Verify and receive VFLY**.

Expected output:

```text
Wallet authorized and asset released
VFLY balance: 1000.0000000
```

Then open the **Audit** tab.

Expected audit event:

```text
Proof verified and claimed
Wallet authorized, nullifier consumed, VFLY released.
```

## 3. Replay Protection Test

Stay in local MVP mode after the happy path.

1. Open the **Investor** tab again.
2. Click **Verify and receive VFLY** again with the same credential.

Expected output:

```text
Proof Rejected
Nullifier already used.
```

The VFLY balance should remain:

```text
1000.0000000
```

## 4. Failed Eligibility Test

1. Open the **Issuer** tab.
2. Set **Tier** to `0`.
3. Click **Generate demo credential**.
4. Click **Save to wallet**.
5. Open the **Investor** tab.

Expected output:

```text
Accreditation: Tier 0
This credential does not meet the issuer policy.
```

The **Verify and receive VFLY** button should be disabled.

## 5. Expired Credential Test

1. Open the **Issuer** tab.
2. Set **Expiry** to a past date.
3. Click **Generate demo credential**.
4. Click **Save to wallet**.
5. Open the **Investor** tab.

Expected output:

```text
Expiry: fail
This credential does not meet the issuer policy.
```

The claim button should be disabled.

## 6. Testnet Contract Configuration

Restore contract IDs in `frontend/.env.local`:

```bash
NEXT_PUBLIC_TOKEN_CONTRACT=CDFC3QDM5DRHN5NBSKZKSPE5AMFDZFE2ZIKA4DPRGXNZ3QFCGIL3M5SI
NEXT_PUBLIC_KYC_VERIFIER_CONTRACT=CD7YDCHR4JTDBYVPIGS2N4RSFYZWDUZ6KJUMD72B7MSKOAJLTUVVCFZ6
NEXT_PUBLIC_VERIFIER_CONTRACT=CBFIXYZYPJEVAD2INE5IPTNQ7YY4LFPM4VMRNESB72ZG6C7INVK2YRL6
ENABLE_TESTNET_FUNDER=false
```

Restart the app.

Expected UI:

```text
Proof gate: testnet
Contracts panel shows Token contract, KYC verifier, and Verifier contract.
```

Important: testnet mode blocks demo proofs. A real testnet claim requires a
credential whose Merkle root matches the circuit witness and is registered in
the verifier contract.

If you use the browser demo credential in testnet mode, expected output is:

```text
ZK Proof Unavailable
Real ZK proof is not available.
```

That is correct behavior. The app is refusing to submit fake proof bytes to the
deployed verifier.

## 7. Testnet Contract Read Checks

Run these from the repo root. Replace `SOURCE` if your Stellar identity has a
different name.

```bash
SOURCE=deployer
TOKEN_ID=CDFC3QDM5DRHN5NBSKZKSPE5AMFDZFE2ZIKA4DPRGXNZ3QFCGIL3M5SI
KYC_VERIFIER_ID=CD7YDCHR4JTDBYVPIGS2N4RSFYZWDUZ6KJUMD72B7MSKOAJLTUVVCFZ6
VERIFIER_ID=CBFIXYZYPJEVAD2INE5IPTNQ7YY4LFPM4VMRNESB72ZG6C7INVK2YRL6
```

Check token symbol:

```bash
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source "$SOURCE" \
  --network testnet \
  -- symbol
```

Expected output:

```text
"VFLY"
```

Check VeriFlo verifier token link:

```bash
stellar contract invoke \
  --id "$VERIFIER_ID" \
  --source "$SOURCE" \
  --network testnet \
  -- token_contract
```

Expected output:

```text
"CDFC3QDM5DRHN5NBSKZKSPE5AMFDZFE2ZIKA4DPRGXNZ3QFCGIL3M5SI"
```

Check verifier admin:

```bash
stellar contract invoke \
  --id "$VERIFIER_ID" \
  --source "$SOURCE" \
  --network testnet \
  -- admin
```

Expected output:

```text
G...
```

Check token admin:

```bash
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source "$SOURCE" \
  --network testnet \
  -- admin
```

Expected output:

```text
"CBFIXYZYPJEVAD2INE5IPTNQ7YY4LFPM4VMRNESB72ZG6C7INVK2YRL6"
```

## 8. Build And Test Verification

Run:

```bash
cargo test
cd frontend
npm test
npm run build
```

Expected output:

```text
cargo test: all contract tests pass
npm test: 11 tests pass
npm run build: Compiled successfully
```

## Current MVP Limit

The current app proves the Soroban verifier flow and VFLY release flow. It does
not yet create a classic Stellar `AUTH_REQUIRED` asset or real claimable
balance. Those are the next production rail tasks after the MVP proof path.
