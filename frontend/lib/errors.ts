export interface VerifloError {
  type:
    | "WALLET_REJECTED"
    | "INSUFFICIENT_XLM"
    | "PROOF_REJECTED"
    | "UNTRUSTED_ROOT"
    | "ALREADY_CLAIMED"
    | "ZK_ASSETS_MISSING"
    | "EXPIRED_CREDENTIAL"
    | "CONTRACT_ERROR";
  message: string;
  recovery: string;
}

// VerifierError codes from veriflo-verifier/src/lib.rs:
//   1 NotInitialized  2 AlreadyInitialized  3 Unauthorized
//   4 KycVerificationFailed  5 NullifierAlreadyUsed  6 ProofVerificationFailed
//   7 UntrustedRoot  8 MalformedInputs  9 RecipientMismatch  10 InvalidTimestamp
//
// Soroban formats these as "Error(Contract, #N)" in diagnostic output.
function contractCode(raw: string): number | null {
  const m = raw.match(/error\(contract,\s*#(\d+)\)/i);
  return m ? parseInt(m[1], 10) : null;
}

export function parseError(err: unknown): VerifloError {
  const msg = err instanceof Error ? err.message : String(err);
  const raw = msg.toLowerCase();
  const code = contractCode(raw);

  if (raw.includes("not connected") || raw.includes("denied") || raw.includes("user declined")) {
    return {
      type: "WALLET_REJECTED",
      message: "Transaction rejected by wallet.",
      recovery: "Open Freighter and approve the transaction.",
    };
  }

  if (raw.includes("404") || raw.includes("not funded") || (raw.includes("not found") && !raw.includes("contract"))) {
    return {
      type: "INSUFFICIENT_XLM",
      message: "Wallet not funded.",
      recovery: "Fund this wallet with testnet XLM via Friendbot before claiming.",
    };
  }

  if (raw.includes("real zk proof unavailable") || raw.includes("demo proof cannot")) {
    return {
      type: "ZK_ASSETS_MISSING",
      message: "Real ZK proof unavailable in testnet mode.",
      recovery: "Switch to Demo mode, or run npm run prepare:circuits to enable real proofs.",
    };
  }

  if (code === 5) {
    return {
      type: "ALREADY_CLAIMED",
      message: "This credential has already been used to claim VFLY.",
      recovery: "Each credential can only be claimed once. Issue a new credential to claim again.",
    };
  }

  if (code === 9) {
    return {
      type: "PROOF_REJECTED",
      message: "Proof is bound to a different wallet address.",
      recovery: "Reconnect the wallet that matches this credential, or issue a new credential for your current wallet.",
    };
  }

  if (code === 7) {
    return {
      type: "UNTRUSTED_ROOT",
      message: "Credential Merkle root is not registered on-chain.",
      recovery: "The issuer needs to publish this root to the Credential Registry before you can claim.",
    };
  }

  if (code === 4 || code === 6) {
    return {
      type: "PROOF_REJECTED",
      message: "ZK proof verification failed.",
      recovery: "Your credential or proof may be corrupt. Re-import the credential file and try again.",
    };
  }

  if (code === 8) {
    return {
      type: "PROOF_REJECTED",
      message: "Proof inputs are malformed.",
      recovery: "Your credential file may be from an older version. Issue a fresh credential.",
    };
  }

  if (code === 10) {
    return {
      type: "EXPIRED_CREDENTIAL",
      message: "Credential has expired.",
      recovery: "Your credential's expiry date has passed. Request a new credential from your issuer.",
    };
  }

  if (code === 3) {
    return {
      type: "CONTRACT_ERROR",
      message: "Unauthorized — only the contract admin can perform this action.",
      recovery: "Check that you are connected with the correct admin wallet.",
    };
  }

  if (raw.includes("simulation failed") || raw.includes("hostfn") || raw.includes("error(contract")) {
    return {
      type: "CONTRACT_ERROR",
      message: "Contract call failed.",
      recovery: "Check the browser console for the full diagnostic. The contract may be uninitialized or the network may be congested.",
    };
  }

  return {
    type: "CONTRACT_ERROR",
    message: "An unexpected error occurred.",
    recovery: "Check the browser console for details.",
  };
}
