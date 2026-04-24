export interface VerifloError {
  type: "WALLET_REJECTED" | "INSUFFICIENT_XLM" | "PROOF_REJECTED";
  message: string;
  recovery: string;
}

export function parseError(err: unknown): VerifloError {
  const msg = err instanceof Error ? err.message : String(err);

  if (
    msg.includes("not connected") ||
    msg.includes("rejected") ||
    msg.includes("denied") ||
    msg.includes("WALLET_REJECTED")
  ) {
    return {
      type: "WALLET_REJECTED",
      message: msg,
      recovery: "Open Freighter and approve the connection request.",
    };
  }

  if (
    msg.includes("404") ||
    msg.includes("not funded") ||
    msg.includes("not found") ||
    msg.includes("INSUFFICIENT_XLM")
  ) {
    return {
      type: "INSUFFICIENT_XLM",
      message: msg,
      recovery: "Fund this account with XLM via the Issuer panel.",
    };
  }

  return {
    type: "PROOF_REJECTED",
    message: msg,
    recovery: "Your proof was rejected. Each proof can only be submitted once.",
  };
}
