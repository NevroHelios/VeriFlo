# ZK Architecture

## Current MVP

VeriFlo now has a real two-contract verification path:

- `kyc-verifier` parses a 256-byte Groth16 proof and verifies it with Stellar
  Protocol 25 BN254 host functions.
- `veriflo-verifier` enforces issuer policy state: trusted Merkle root,
  nullifier replay protection, wallet binding, KYC verifier result, then VFLY
  authorization and minting.

The public inputs are fixed and must contain exactly five 32-byte field values:

```text
[nullifier, merkle_root, min_accreditation, current_time, recipient]
```

The recipient field is deterministic: `0x00 || first31(sha256(ScVal::Address
XDR))`. The contract recomputes that value from the signed `user` address, so a
proof generated for one wallet cannot be submitted by another wallet.

## Frontend Proof Modes

The frontend has two explicit modes:

- Local MVP mode, when no deployed verifier contract is configured. It uses the
  browser-local demo ledger and can accept demo credentials.
- Testnet mode, when `NEXT_PUBLIC_VERIFIER_CONTRACT` is configured. It refuses
  demo proofs and only submits real `snarkjs` Groth16 proofs.

`npm run dev` and `npm run build` run `npm run prepare:circuits`, which copies
the circuit WASM and final zkey into `frontend/public/circuits`.

## Known Production Gap

The current asset rail is a Soroban token controlled by the verifier contract.
That makes the MVP functional and testable end to end, but it is not yet the
classic Stellar `AUTH_REQUIRED` plus claimable balance distribution rail.

To complete the production rail, replace the custom VFLY token deployment with
a Stellar Asset Contract for the issued asset, then wire issuer-side
authorization, clawback policy, trustline creation, and claimable balance
funding around the verified wallet state.
