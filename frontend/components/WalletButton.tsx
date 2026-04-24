"use client";

import { VerifloError } from "@/lib/errors";

interface Props {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  error: VerifloError | null;
  connect: () => void;
  disconnect: () => void;
}

export default function WalletButton({
  publicKey,
  connected,
  connecting,
  error,
  connect,
  disconnect,
}: Props) {
  const truncated = publicKey
    ? `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}`
    : null;

  return (
    <div className="flex flex-col items-end gap-1">
      {connected ? (
        <button
          onClick={disconnect}
          className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-mono hover:bg-slate-600 transition-colors"
        >
          {truncated} · Disconnect
        </button>
      ) : (
        <button
          onClick={connect}
          disabled={connecting}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {connecting ? "Connecting…" : "Connect Wallet"}
        </button>
      )}
      {error && (
        <p className="text-red-400 text-xs max-w-xs text-right">
          {error.message}
        </p>
      )}
    </div>
  );
}
