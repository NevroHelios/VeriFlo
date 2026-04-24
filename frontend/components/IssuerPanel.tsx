"use client";

import { useState } from "react";
import TransactionStatus from "@/components/TransactionStatus";
import { parseError, VerifloError } from "@/lib/errors";

export default function IssuerPanel() {
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<VerifloError | null>(null);

  async function fundUser() {
    if (!recipient.trim()) return;
    setStatus("pending");
    setHash(null);
    setError(null);
    try {
      const res = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toPublicKey: recipient.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fund request failed");
      setHash(data.hash);
      setStatus("success");
    } catch (err) {
      setError(parseError(err));
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-white">Issuer Panel</h2>
      <p className="text-slate-400 text-sm">
        Fund a user account with XLM so they can pay Soroban transaction fees.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Recipient G… address"
          className="flex-1 px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-mono border border-slate-600 focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={fundUser}
          disabled={status === "pending" || !recipient.trim()}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {status === "pending" ? "Sending…" : "Fund User"}
        </button>
      </div>
      <TransactionStatus hash={hash} status={status} error={error} />
    </div>
  );
}
