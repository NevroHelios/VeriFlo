# VeriFlo Frontend

Next.js MVP console for compliant asset distribution on Stellar.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
```

`npm run dev` and `npm run build` run `prepare:circuits`, copying:

- `circuits/build/kyc_eligibility_js/kyc_eligibility.wasm`
- `circuits/build/kyc_eligibility_final.zkey`

into `frontend/public/circuits`.

## Modes

- **Local MVP:** no contract IDs. The browser stores demo credentials,
  nullifiers, claims, and audit events locally.
- **Testnet:** set `NEXT_PUBLIC_TOKEN_CONTRACT`,
  `NEXT_PUBLIC_KYC_VERIFIER_CONTRACT`, and `NEXT_PUBLIC_VERIFIER_CONTRACT`.
  Demo proofs are blocked; the app only submits real Groth16 proofs.

## Main Files

- `components/AppShell.tsx` - product shell, navigation, hero, audit stream.
- `components/UserClaimPanel.tsx` - credential import and proof submission.
- `components/IssuerPanel.tsx` - policy, demo reserve, credential issue.
- `lib/zk.ts` - Poseidon nullifier, wallet binding, snarkjs proof generation.
- `lib/soroban.ts` - Soroban invocation with local MVP fallback.
- `lib/demoLedger.ts` - local nullifier replay protection and audit events.
