"use client";

import { useState } from "react";
import { generateMockProof } from "@/lib/mockZK";
import { submitProof } from "@/lib/soroban";
import { parseError, VerifloError } from "@/lib/errors";
import TransactionStatus from "@/components/TransactionStatus";

interface Props {
  publicKey: string | null;
  onSuccess?: () => void;
}

export default function UserClaimPanel({ publicKey, onSuccess }: Props) {
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<VerifloError | null>(null);

  async function handleSubmit() {
    if (!publicKey) return;
    setStatus("pending");
    setHash(null);
    setError(null);
    try {
      const proof = generateMockProof(publicKey);
      const txHash = await submitProof(publicKey, proof);
      setHash(txHash);
      setStatus("success");
      onSuccess?.();
    } catch (err) {
      setError(parseError(err));
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-white">Submit KYC Proof</h2>
      <p className="text-slate-400 text-sm">
        Generate and submit a mock ZK proof to receive VFLY tokens.
        Each wallet address can only claim once.
      </p>
      {!publicKey ? (
        <p className="text-yellow-400 text-sm">Connect your wallet first.</p>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={status === "pending"}
          className="px-4 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {status === "pending" ? "Submitting proof…" : "Submit KYC Proof"}
        </button>
      )}
      <TransactionStatus hash={hash} status={status} error={error} />
    </div>
  );
}
