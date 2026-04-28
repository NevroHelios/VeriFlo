"use client";

import { VerifloError } from "@/lib/errors";

interface Props {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  demo: boolean;
  error: VerifloError | null;
  connect: () => void;
  connectDemo: () => void;
  disconnect: () => void;
}

export default function WalletButton({
  publicKey,
  connected,
  connecting,
  demo,
  error,
  connect,
  connectDemo,
  disconnect,
}: Props) {
  const truncated = publicKey
    ? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`
    : null;

  return (
    <div className="wallet-actions">
      {connected ? (
        <button
          onClick={disconnect}
          className="wallet-chip"
        >
          <span className="live-dot" />
          <span>{demo ? "Demo" : "Freighter"}</span>
          <span className="mono">{truncated}</span>
        </button>
      ) : (
        <div className="wallet-connect-row">
          <button
            onClick={connect}
            disabled={connecting}
            className="button button-primary"
          >
            {connecting ? "Connecting..." : "Connect Freighter"}
          </button>
          <button onClick={connectDemo} className="button button-secondary">
            Demo wallet
          </button>
        </div>
      )}
      {error && (
        <p className="wallet-error">
          {error.message}
        </p>
      )}
    </div>
  );
}
