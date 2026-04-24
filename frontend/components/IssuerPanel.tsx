"use client";

import { useState } from "react";
import TransactionStatus from "@/components/TransactionStatus";
import { parseError, VerifloError } from "@/lib/errors";

interface FundState {
  status: "idle" | "pending" | "success" | "error";
  hash: string | null;
  error: VerifloError | null;
}

interface CredentialForm {
  recipientAddress: string;
  jurisdiction: string;
  accreditation: string;
  expiry: string;
}

const INITIAL_FORM: CredentialForm = {
  recipientAddress: "",
  jurisdiction: "91",
  accreditation: "1",
  expiry: "2028-12-31",
};

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Placeholder Merkle root — matches the trusted root registered on testnet
const DEMO_MERKLE_ROOT = "aa".repeat(32);

function buildCredentialJson(form: CredentialForm, nonce: string) {
  const expiry = Math.floor(new Date(form.expiry).getTime() / 1000);
  return {
    jurisdiction: parseInt(form.jurisdiction),
    accreditation: parseInt(form.accreditation),
    expiry,
    issuer_id: "VERIFLO_DEMO_ISSUER_001",
    nonce,
    merkle_root: DEMO_MERKLE_ROOT,
    merkle_siblings: Array(20).fill("00".repeat(32)),
    merkle_path: Array(20).fill(0),
  };
}

export default function IssuerPanel() {
  const [fund, setFund] = useState<FundState>({ status: "idle", hash: null, error: null });
  const [form, setForm] = useState<CredentialForm>(INITIAL_FORM);
  const [credJson, setCredJson] = useState<string | null>(null);

  async function handleFund() {
    if (!form.recipientAddress.trim()) return;
    setFund({ status: "pending", hash: null, error: null });
    try {
      const res = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toPublicKey: form.recipientAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fund request failed");
      setFund({ status: "success", hash: data.hash, error: null });
    } catch (err) {
      setFund({ status: "error", hash: null, error: parseError(err) });
    }
  }

  function handleGenerateCredential() {
    const nonce = randomHex(16);
    const cred = buildCredentialJson(form, nonce);
    setCredJson(JSON.stringify(cred, null, 2));
  }

  function handleDownload() {
    if (!credJson) return;
    const blob = new Blob([credJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "veriflo_credential.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = (key: keyof CredentialForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Issuer Dashboard</h2>
        <p className="text-slate-400 text-sm">
          Fund a wallet with XLM for gas, then issue a KYC credential the user imports
          in the User tab.
        </p>
      </div>

      {/* Recipient address — shared across both actions */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400 font-medium">User wallet address (G…)</label>
        <input
          type="text"
          placeholder="GABCDEF..."
          className="px-3 py-2 rounded-lg bg-slate-700 text-white text-sm font-mono border border-slate-600 focus:border-indigo-500 focus:outline-none"
          {...field("recipientAddress")}
        />
      </div>

      {/* Step 1: Fund XLM */}
      <div className="flex flex-col gap-3 border border-slate-700 rounded-lg p-4">
        <p className="text-sm font-medium text-slate-200">Step 1 — Send XLM for gas</p>
        <button
          onClick={handleFund}
          disabled={fund.status === "pending" || !form.recipientAddress.trim()}
          className="px-4 py-2 rounded-lg bg-slate-600 text-white text-sm font-semibold hover:bg-slate-500 disabled:opacity-50 transition-colors self-start"
        >
          {fund.status === "pending" ? "Sending…" : "Fund 10 XLM"}
        </button>
        <TransactionStatus hash={fund.hash} status={fund.status} error={fund.error} />
      </div>

      {/* Step 2: Issue credential */}
      <div className="flex flex-col gap-3 border border-slate-700 rounded-lg p-4">
        <p className="text-sm font-medium text-slate-200">Step 2 — Issue KYC credential</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Jurisdiction</label>
            <input
              type="number"
              className="px-2 py-1.5 rounded bg-slate-700 text-white text-sm border border-slate-600 focus:border-indigo-500 focus:outline-none"
              {...field("jurisdiction")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Accreditation (0-2)</label>
            <input
              type="number"
              min="0"
              max="2"
              className="px-2 py-1.5 rounded bg-slate-700 text-white text-sm border border-slate-600 focus:border-indigo-500 focus:outline-none"
              {...field("accreditation")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Expiry</label>
            <input
              type="date"
              className="px-2 py-1.5 rounded bg-slate-700 text-white text-sm border border-slate-600 focus:border-indigo-500 focus:outline-none"
              {...field("expiry")}
            />
          </div>
        </div>

        <button
          onClick={handleGenerateCredential}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors self-start"
        >
          Generate credential
        </button>

        {credJson && (
          <div className="flex flex-col gap-2">
            <pre className="text-xs font-mono bg-slate-900 rounded p-3 overflow-x-auto text-slate-300 max-h-40">
              {credJson}
            </pre>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-600 transition-colors self-start"
            >
              Download credential.json
            </button>
            <p className="text-xs text-slate-400">
              Send this file to the user. They import it in the <strong className="text-slate-300">User</strong> tab.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
