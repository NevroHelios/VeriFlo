import {
  KYC_VERIFIER_CONTRACT,
  TOKEN_CONTRACT,
  VERIFIER_CONTRACT,
} from "@/constants";

export type RuntimeMode = "demo" | "testnet";

const STORAGE_KEY = "veriflo:mvp:runtime-mode";

export function hasTestnetConfig(): boolean {
  return Boolean(TOKEN_CONTRACT && KYC_VERIFIER_CONTRACT && VERIFIER_CONTRACT);
}

export function loadRuntimeMode(): RuntimeMode {
  if (typeof window === "undefined") return "demo";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "testnet" && hasTestnetConfig()) return "testnet";
  return "demo";
}

export function saveRuntimeMode(mode: RuntimeMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}
