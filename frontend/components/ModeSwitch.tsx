"use client";

import type { RuntimeMode } from "@/lib/runtimeMode";
import { hasTestnetConfig } from "@/lib/runtimeMode";

interface Props {
  mode: RuntimeMode;
  onChange: (mode: RuntimeMode) => void;
}

export default function ModeSwitch({ mode, onChange }: Props) {
  const testnetReady = hasTestnetConfig();

  return (
    <div className="mode-switch" aria-label="Execution mode">
      <button
        type="button"
        className={mode === "demo" ? "mode-button active" : "mode-button"}
        onClick={() => onChange("demo")}
      >
        Demo
      </button>
      <button
        type="button"
        className={mode === "testnet" ? "mode-button active" : "mode-button"}
        onClick={() => onChange("testnet")}
        disabled={!testnetReady}
        title={testnetReady ? "Use deployed testnet contracts" : "Missing contract IDs"}
      >
        Testnet
      </button>
    </div>
  );
}
