# ZK Architecture

## Prototype (Current)

The verifier contract uses a **mock ZK check**: `proof.len() > 32`. This is explicitly disclosed in the README and in the contract source.

**Replay prevention is real:** the contract computes `sha256(proof)` and stores the resulting 32-byte nullifier in persistent storage. A proof can only be used once, even in the mock implementation.

## Production Design

A real ZK circuit would replace the length check with a Groth16 verifier.

**Protocol 25 (BN254)** — live on Stellar mainnet since January 22, 2026 — provides the necessary host functions:

- `env.crypto().bn254_g1_add()`
- `env.crypto().bn254_g1_mul()`
- `env.crypto().bn254_pairing_check()`

A Groth16 verifier built on these primitives can verify a proof that the user knows a secret (e.g., a government ID credential) without revealing it.

**Estimated effort:** 3–4 weeks to implement a full Groth16 verifier contract + matching circuit in Circom or Noir.

## Why Mocked for This Prototype

No `groth16_verify()` host function exists. The BN254 primitives are available but building a complete verifier on top is weeks of work. The architecture — contract flow, nullifiers, cross-contract admin calls, frontend integration — is identical whether the ZK check is real or mocked.
