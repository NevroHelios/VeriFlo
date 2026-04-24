export interface VerifloError {
  type: "WALLET_REJECTED" | "INSUFFICIENT_XLM" | "PROOF_REJECTED" | "UNTRUSTED_ROOT" | "ALREADY_AUTHORIZED" | "CONTRACT_ERROR";
  message: string;
  recovery: string;
}

export function parseError(err: unknown): VerifloError {
  const msg = err instanceof Error ? err.message : String(err);
  const raw = msg.toLowerCase();

  if (raw.includes("not connected") || raw.includes("denied") || raw.includes("user declined")) {
    return {
      type: "WALLET_REJECTED",
      message: msg,
      recovery: "Open Freighter and approve the transaction.",
    };
  }

  if (raw.includes("404") || raw.includes("not funded") || (raw.includes("not found") && !raw.includes("contract"))) {
    return {
      type: "INSUFFICIENT_XLM",
      message: msg,
      recovery: "Use the Issuer panel to fund this wallet with XLM first.",
    };
  }

  // Contract-level errors: extract the Error(...) code from the diagnostic
  if (raw.includes("nullifierreused") || raw.includes("error(contract, 3)")) {
    return {
      type: "PROOF_REJECTED",
      message: "Nullifier already used.",
      recovery: "This proof has already been submitted. Each wallet can only claim once.",
    };
  }

  if (raw.includes("alreadyauthorized") || raw.includes("error(contract, 5)")) {
    return {
      type: "ALREADY_AUTHORIZED",
      message: "Wallet already authorized.",
      recovery: "This wallet has already claimed VFLY tokens.",
    };
  }

  if (raw.includes("untrustedroot") || raw.includes("error(contract, 7)")) {
    return {
      type: "UNTRUSTED_ROOT",
      message: "Credential root not trusted.",
      recovery: "The Merkle root in your credential is not registered with this verifier. Contact your issuer.",
    };
  }

  if (raw.includes("malformedinputs") || raw.includes("proofinvalid") || raw.includes("error(contract, 4)") || raw.includes("error(contract, 8)")) {
    return {
      type: "PROOF_REJECTED",
      message: "Proof or public inputs malformed.",
      recovery: "Your credential file may be corrupt. Try re-importing it.",
    };
  }

  if (raw.includes("simulation failed") || raw.includes("hostfn") || raw.includes("error(contract")) {
    return {
      type: "CONTRACT_ERROR",
      message: msg,
      recovery: "Contract call failed. Check the browser console for the full error.",
    };
  }

  return {
    type: "CONTRACT_ERROR",
    message: msg,
    recovery: "Something went wrong. Check the browser console for details.",
  };
}
