"use client";

import { useWallet } from "@/hooks/useWallet";
import { useBalance } from "@/hooks/useBalance";
import WalletButton from "@/components/WalletButton";
import BalanceDisplay from "@/components/BalanceDisplay";
import IssuerPanel from "@/components/IssuerPanel";
import UserClaimPanel from "@/components/UserClaimPanel";

export default function AppShell() {
  const wallet = useWallet();
  const balance = useBalance(wallet.publicKey);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 sticky top-0 bg-slate-900/90 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
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

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <IssuerPanel />
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <UserClaimPanel
              publicKey={wallet.publicKey}
              onSuccess={balance.refetch}
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-400">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <p className="font-semibold text-slate-300 mb-1">VFLY Token</p>
            <p className="font-mono text-xs break-all">
              {process.env.NEXT_PUBLIC_TOKEN_CONTRACT || "not set"}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <p className="font-semibold text-slate-300 mb-1">Verifier Contract</p>
            <p className="font-mono text-xs break-all">
              {process.env.NEXT_PUBLIC_VERIFIER_CONTRACT || "not set"}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <p className="font-semibold text-slate-300 mb-1">Network</p>
            <p className="text-xs">Stellar Testnet (Soroban Protocol 22+)</p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        <a
          href="https://forms.gle/placeholder"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-300 transition-colors"
        >
          User Onboarding Form
        </a>
        {" · "}
        <span>VeriFlo · Stellar Testnet Demo</span>
      </footer>
    </div>
  );
}
