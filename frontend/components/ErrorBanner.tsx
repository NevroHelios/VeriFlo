"use client";

import { useState } from "react";
import { VerifloError } from "@/lib/errors";

const TYPE_LABELS: Record<VerifloError["type"], string> = {
  WALLET_REJECTED: "Wallet Rejected",
  INSUFFICIENT_XLM: "Insufficient XLM",
  PROOF_REJECTED: "Proof Rejected",
};

const TYPE_COLORS: Record<VerifloError["type"], string> = {
  WALLET_REJECTED: "border-yellow-500 bg-yellow-950 text-yellow-200",
  INSUFFICIENT_XLM: "border-orange-500 bg-orange-950 text-orange-200",
  PROOF_REJECTED: "border-red-500 bg-red-950 text-red-200",
};

interface Props {
  error: VerifloError;
}

export default function ErrorBanner({ error }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      className={`border rounded-lg p-4 flex flex-col gap-1 ${TYPE_COLORS[error.type]}`}
    >
      <div className="flex justify-between items-start">
        <span className="font-semibold text-sm">{TYPE_LABELS[error.type]}</span>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs opacity-60 hover:opacity-100 ml-4"
        >
          ✕
        </button>
      </div>
      <p className="text-xs opacity-80">{error.message}</p>
      <p className="text-xs font-medium mt-1">{error.recovery}</p>
    </div>
  );
}
