"use client";

import { useBalance } from "@/hooks/useBalance";

interface Props {
  publicKey: string | null;
}

export default function BalanceDisplay({ publicKey }: Props) {
  const { xlm, vfly, loading, error, refetch } = useBalance(publicKey);

  if (!publicKey) return null;

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-slate-400">XLM</span>{" "}
          <span className="font-mono font-semibold text-white">
            {loading ? "…" : xlm}
          </span>
        </div>
        <div>
          <span className="text-slate-400">VFLY</span>{" "}
          <span className="font-mono font-semibold text-indigo-300">
            {loading ? "…" : vfly}
          </span>
        </div>
      </div>
      <button
        onClick={refetch}
        disabled={loading}
        className="text-xs text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
      >
        ↻ Refresh
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
