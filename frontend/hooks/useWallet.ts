"use client";

import { useState } from "react";
import { parseError, VerifloError } from "@/lib/errors";

interface WalletState {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  error: VerifloError | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useWallet(): WalletState {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<VerifloError | null>(null);

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const freighter = await import("@stellar/freighter-api");

      const connResult = await freighter.isConnected();
      if (!connResult.isConnected) {
        throw new Error("Freighter is not connected");
      }

      const allowedResult = await freighter.isAllowed();
      if (!allowedResult.isAllowed) {
        await freighter.setAllowed();
      }

      const pkResult = await freighter.getPublicKey();
      if (!pkResult.publicKey) {
        throw new Error("Could not get public key from Freighter");
      }

      setPublicKey(pkResult.publicKey);
      setConnected(true);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    setPublicKey(null);
    setConnected(false);
    setError(null);
  }

  return { publicKey, connected, connecting, error, connect, disconnect };
}
