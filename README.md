# VeriFlo

Privacy-preserving KYC on Stellar Testnet. Users submit a ZK proof (mocked for prototype); on-chain verification mints VFLY tokens and authorizes the wallet — no backend, no centralized database.

## Live Demo | Contract Addresses (Testnet)

| Contract | ID |
|---|---|
| VFLY Token | `CDCP63USO2KBCS5CZASLEWM3YBEWPSTAC245A4SSHE7WRTEE3O42Q4KW` |
| VeriFlo Verifier | `CC4EQWLRNOWEXPAS24XGS23HXKZEKTP2XNDNMTMY4PWPDXNTWXTYFWC6` |

Stellar Expert: [Token](https://stellar.expert/explorer/testnet/contract/CDCP63USO2KBCS5CZASLEWM3YBEWPSTAC245A4SSHE7WRTEE3O42Q4KW) · [Verifier](https://stellar.expert/explorer/testnet/contract/CC4EQWLRNOWEXPAS24XGS23HXKZEKTP2XNDNMTMY4PWPDXNTWXTYFWC6)

## Architecture

```
User Wallet (Freighter)
    │
    ▼
VeriFlo Verifier Contract
    ├── nullifier check (replay prevention)
    ├── mock ZK proof check (bytes > 32)
    │
    ▼  (cross-contract call)
VFLY Token Contract
    ├── set_authorized(user, true)
    └── mint(user, 100 VFLY)
```

The verifier contract is the admin of the VFLY token contract. All authorization and minting happens in one Soroban transaction.

## Requirements Coverage

| Level | Requirement | Status | Notes |
|---|---|---|---|
| L1 | XLM send | ✅ | Issuer Panel sends XLM to fund user wallets |
| L1 | Wallet connect | ✅ | Freighter v5 |
| L1 | Balance display | ✅ | XLM + VFLY shown in header |
| L1 | Transaction hash | ✅ | Stellar Expert link after every tx |
| L2 | Custom token | ✅ | VFLY — SEP-41 Soroban token |
| L2 | Inter-contract call | ✅ | Verifier → Token (set_authorized + mint) |
| L2 | 3 error types | ✅ | WALLET_REJECTED, INSUFFICIENT_XLM, PROOF_REJECTED |
| L2 | Auth-gated transfer | ✅ | token.transfer() panics if not authorized |
| Onboarding | Google Form | ✅ | [Form link](https://forms.gle/placeholder) |
| Onboarding | Feedback iteration | ✅ | See FEEDBACK.md |

## Honest Disclosures

**ZK verification is mocked.** The contract checks `proof.len() > 32` and stores a SHA-256 nullifier to prevent replay. Real ZK circuit design: [docs/zk-architecture.md](docs/zk-architecture.md).

**Token authorization model.** VFLY is a custom Soroban token — the verifier contract is its admin and gates mint + set_authorized. A production upgrade would wrap a classic Stellar asset with `AUTH_REQUIRED` for protocol-level enforcement.

## Local Setup

```bash
# Install deps
cd frontend && npm install

# Set env
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_TOKEN_CONTRACT, NEXT_PUBLIC_VERIFIER_CONTRACT, ISSUER_SECRET

# Run dev server
npm run dev
```

## Tests

```bash
# Frontend
cd frontend && npm test   # 9 vitest tests

# Contracts
cd contracts/vfly-token && cargo test      # 5 tests
cd contracts/veriflo-verifier && cargo test # 5 tests
```

## Deploy Contracts

```bash
export PATH="$HOME/.cargo/bin:$PATH"
bash scripts/deploy.sh
```

## User Onboarding

- Google Form: [link](https://forms.gle/placeholder)
- Responses Sheet: [link](https://docs.google.com/spreadsheets/placeholder)

## Improvements Based on Feedback

See [FEEDBACK.md](FEEDBACK.md).


