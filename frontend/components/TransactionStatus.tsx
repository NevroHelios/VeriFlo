"use client";

import { VerifloError } from "@/lib/errors";
import ErrorBanner from "@/components/ErrorBanner";
import { STELLAR_EXPERT_URL } from "@/constants";

interface Props {
  hash: string | null;
  status: "idle" | "pending" | "success" | "error";
  error: VerifloError | null;
  explorer?: boolean;
  successLabel?: string;
}

export default function TransactionStatus({
  hash,
  status,
  error,
  explorer = true,
  successLabel = "Transaction confirmed",
}: Props) {
  if (status === "idle") return null;

  if (status === "pending") {
    return (
      <div className="tx-status pending">
        <span className="spinner" />
        <span>Submitting transaction...</span>
      </div>
    );
  }

  if (status === "error" && error) {
    return <ErrorBanner error={error} />;
  }

  if (status === "success" && hash) {
    const truncated = `${hash.slice(0, 8)}...${hash.slice(-8)}`;
    return (
      <div className="tx-status success">
        <span>{successLabel}</span>
        {explorer ? (
          <a
            href={`${STELLAR_EXPERT_URL}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hash-text"
          >
            {truncated}
          </a>
        ) : (
          <span className="hash-text">{truncated}</span>
        )}
      </div>
    );
  }

  return null;
}
