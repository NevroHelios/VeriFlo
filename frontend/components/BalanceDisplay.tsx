"use client";

import { useEffect } from "react";
import { useBalance } from "@/hooks/useBalance";

interface Props {
  publicKey: string | null;
  demo?: boolean;
  refreshKey?: number;
}

export default function BalanceDisplay({
  publicKey,
  demo = false,
  refreshKey = 0,
}: Props) {
  const { xlm, vfly, loading, error, refetch } = useBalance(publicKey, demo);

  useEffect(() => {
    refetch();
  }, [refreshKey, refetch]);

  if (!publicKey) return null;

  return (
    <div className="balance-strip">
      <div className="balance-values">
        <div>
          <span>XLM</span>
          <strong className="mono">
            {loading ? "..." : xlm}
          </strong>
        </div>
        <div>
          <span>VFLY</span>
          <strong className="mono accent-teal">
            {loading ? "..." : vfly}
          </strong>
        </div>
      </div>
      <button
        onClick={refetch}
        disabled={loading}
        className="icon-button"
        aria-label="Refresh balances"
        title="Refresh balances"
      >
        R
      </button>
      {error && <p className="inline-error">{error}</p>}
    </div>
  );
}
