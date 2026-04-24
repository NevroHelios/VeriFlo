"use client";

import { VerifloError } from "@/lib/errors";
import ErrorBanner from "@/components/ErrorBanner";
import { STELLAR_EXPERT_URL } from "@/constants";

interface Props {
  hash: string | null;
  status: "idle" | "pending" | "success" | "error";
  error: VerifloError | null;
}

export default function TransactionStatus({ hash, status, error }: Props) {
  if (status === "idle") return null;

  if (status === "pending") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <span className="animate-spin">⟳</span> Submitting transaction…
      </div>
    );
  }

  if (status === "error" && error) {
    return <ErrorBanner error={error} />;
  }

  if (status === "success" && hash) {
    const truncated = `${hash.slice(0, 8)}…${hash.slice(-8)}`;
    return (
      <div className="border border-green-500 bg-green-950 text-green-200 rounded-lg p-4 flex flex-col gap-1">
        <span className="font-semibold text-sm">Transaction confirmed</span>
        <a
          href={`${STELLAR_EXPERT_URL}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono underline opacity-80 hover:opacity-100 break-all"
        >
          {truncated}
        </a>
      </div>
    );
  }

  return null;
}
