"use client";

import { useState } from "react";
import { VerifloError } from "@/lib/errors";

const TYPE_LABELS: Record<VerifloError["type"], string> = {
  WALLET_REJECTED: "Wallet Rejected",
  INSUFFICIENT_XLM: "Insufficient XLM",
  PROOF_REJECTED: "Proof Rejected",
  UNTRUSTED_ROOT: "Untrusted Credential",
  ALREADY_AUTHORIZED: "Already Authorized",
  ZK_ASSETS_MISSING: "ZK Proof Unavailable",
  CONTRACT_ERROR: "Contract Error",
};

const TYPE_COLORS: Record<VerifloError["type"], string> = {
  WALLET_REJECTED: "warning",
  INSUFFICIENT_XLM: "warning",
  PROOF_REJECTED: "danger",
  UNTRUSTED_ROOT: "danger",
  ALREADY_AUTHORIZED: "info",
  ZK_ASSETS_MISSING: "warning",
  CONTRACT_ERROR: "danger",
};

interface Props {
  error: VerifloError;
}

export default function ErrorBanner({ error }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className={`error-banner ${TYPE_COLORS[error.type]}`}>
      <div className="error-title-row">
        <span>{TYPE_LABELS[error.type]}</span>
        <button
          onClick={() => setDismissed(true)}
          className="icon-button"
          aria-label="Dismiss error"
          title="Dismiss"
        >
          X
        </button>
      </div>
      <p>{error.message}</p>
      <strong>{error.recovery}</strong>
    </div>
  );
}
