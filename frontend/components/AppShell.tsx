"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useBalance } from "@/hooks/useBalance";
import WalletButton from "@/components/WalletButton";
import BalanceDisplay from "@/components/BalanceDisplay";
import IssuerPanel from "@/components/IssuerPanel";
import UserClaimPanel from "@/components/UserClaimPanel";

type Tab = "user" | "issuer";

export default function AppShell() {
  const [tab, setTab] = useState<Tab>("user");
  const wallet = useWallet();
  const balance = useBalance(wallet.publicKey);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 sticky top-0 bg-slate-900/90 backdrop-blur z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-indigo-400">Veri</span>Flo
            </h1>
            <p className="text-xs text-slate-400">ZK Identity · Soroban · Testnet</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            {wallet.connected && <BalanceDisplay publicKey={wallet.publicKey} />}
            <WalletButton
              publicKey={wallet.publicKey}
              connected={wallet.connected}
              connecting={wallet.connecting}
              error={wallet.error}
              connect={wallet.connect}
              disconnect={wallet.disconnect}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto px-4 py-8 w-full">
        {/* Tab selector */}
        <div className="flex rounded-lg bg-slate-800 border border-slate-700 p-1 mb-6">
          <button
            onClick={() => setTab("user")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "user"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            User — Claim VFLY
          </button>
          <button
            onClick={() => setTab("issuer")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "issuer"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Issuer — Fund &amp; Issue
          </button>
        </div>

        {/* Panel */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          {tab === "user" ? (
            <UserClaimPanel
              publicKey={wallet.publicKey}
              onSuccess={balance.refetch}
            />
          ) : (
            <IssuerPanel />
          )}
        </div>

        {/* Contract addresses */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-400">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <p className="font-semibold text-slate-300 mb-1 text-xs">VFLY Token</p>
            <p className="font-mono text-xs break-all opacity-70">
              {process.env.NEXT_PUBLIC_TOKEN_CONTRACT || "not set"}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <p className="font-semibold text-slate-300 mb-1 text-xs">Verifier</p>
            <p className="font-mono text-xs break-all opacity-70">
              {process.env.NEXT_PUBLIC_VERIFIER_CONTRACT || "not set"}
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        VeriFlo · Stellar Testnet · ZK-powered KYC
      </footer>
    </div>
  );
}
