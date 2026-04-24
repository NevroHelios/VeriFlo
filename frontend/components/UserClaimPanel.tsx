"use client";

import { useState } from "react";
import { generateProof } from "@/lib/zk";
import { submitProof } from "@/lib/soroban";
import { parseError, VerifloError } from "@/lib/errors";
import TransactionStatus from "@/components/TransactionStatus";
import CredentialPanel from "@/components/CredentialPanel";
import type { Credential } from "@/lib/credential";
import { loadCredential } from "@/lib/credential";

interface Props {
  publicKey: string | null;
  onSuccess?: () => void;
}

export default function UserClaimPanel({ publicKey, onSuccess }: Props) {
  const [credential, setCredential] = useState<Credential | null>(() => {
    if (typeof window === "undefined") return null;
    return loadCredential();
  });
  const [status, setStatus] = useState<"idle" | "proving" | "pending" | "success" | "error">("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<VerifloError | null>(null);

  async function handleSubmit() {
    if (!publicKey || !credential) return;
    setStatus("proving");
    setHash(null);
    setError(null);
    try {
      const { proofBytes, publicInputs } = await generateProof(credential, publicKey);
      setStatus("pending");
      const txHash = await submitProof(publicKey, proofBytes, publicInputs);
      setHash(txHash);
      setStatus("success");
      onSuccess?.();
    } catch (err) {
      setError(parseError(err));
      setStatus("error");
    }
  }

  const canSubmit = !!publicKey && !!credential && status !== "proving" && status !== "pending";

  return (
    <div className="flex flex-col gap-6">
      <CredentialPanel onCredentialChange={setCredential} />

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white">Submit KYC Proof</h2>
        <p className="text-slate-400 text-sm">
          Your credential stays private. A zero-knowledge proof is generated in your browser
          and submitted on-chain to authorize your wallet and mint VFLY tokens.
        </p>
        {!publicKey && (
          <p className="text-yellow-400 text-sm">Connect your wallet first.</p>
        )}
        {publicKey && !credential && (
          <p className="text-yellow-400 text-sm">Import a credential above to continue.</p>
        )}
        {canSubmit && (
          <button
            onClick={handleSubmit}
            className="px-4 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors"
          >
            Generate proof &amp; claim VFLY
          </button>
        )}
        {status === "proving" && (
          <p className="text-slate-300 text-sm">Generating zero-knowledge proof…</p>
        )}
        {status === "pending" && (
          <p className="text-slate-300 text-sm">Submitting proof on-chain…</p>
        )}
        <TransactionStatus hash={hash} status={status === "proving" ? "pending" : status} error={error} />
      </div>
    </div>
  );
}
