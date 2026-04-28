"use client";

import { useState } from "react";
import { parseError, VerifloError } from "@/lib/errors";
import { DEMO_PUBLIC_KEY } from "@/lib/demoLedger";

const DEMO_WALLET_KEY = "veriflo:mvp:demo-wallet";

interface WalletState {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  demo: boolean;
  error: VerifloError | null;
  connect: () => Promise<void>;
  connectDemo: () => void;
  disconnect: () => void;
}

export function useWallet(): WalletState {
  const [publicKey, setPublicKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(DEMO_WALLET_KEY) === "true"
      ? DEMO_PUBLIC_KEY
      : null;
  });
  const [connected, setConnected] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DEMO_WALLET_KEY) === "true";
  });
  const [connecting, setConnecting] = useState(false);
  const [demo, setDemo] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DEMO_WALLET_KEY) === "true";
  });
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

      const addrResult = await freighter.getAddress();
      if (!addrResult.address) {
        throw new Error("Could not get address from Freighter");
      }

      setPublicKey(addrResult.address);
      setConnected(true);
      setDemo(false);
      window.localStorage.removeItem(DEMO_WALLET_KEY);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setConnecting(false);
    }
  }

  function connectDemo() {
    setPublicKey(DEMO_PUBLIC_KEY);
    setConnected(true);
    setDemo(true);
    setError(null);
    window.localStorage.setItem(DEMO_WALLET_KEY, "true");
  }

  function disconnect() {
    setPublicKey(null);
    setConnected(false);
    setDemo(false);
    setError(null);
    window.localStorage.removeItem(DEMO_WALLET_KEY);
  }

  return {
    publicKey,
    connected,
    connecting,
    demo,
    error,
    connect,
    connectDemo,
    disconnect,
  };
}
