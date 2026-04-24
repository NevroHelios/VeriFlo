"use client";

import { useState, useRef } from "react";
import {
  loadCredential,
  saveCredential,
  clearCredential,
  parseCredentialFile,
  type Credential,
} from "@/lib/credential";

interface Props {
  onCredentialChange: (cred: Credential | null) => void;
}

export default function CredentialPanel({ onCredentialChange }: Props) {
  const [credential, setCredential] = useState<Credential | null>(() => {
    if (typeof window === "undefined") return null;
    return loadCredential();
  });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const cred = parseCredentialFile(ev.target?.result as string);
        saveCredential(cred);
        setCredential(cred);
        onCredentialChange(cred);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid credential file");
      }
    };
    reader.readAsText(file);
  }

  function handleClear() {
    clearCredential();
    setCredential(null);
    onCredentialChange(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-white">KYC Credential</h2>
      {credential ? (
        <div className="rounded-lg bg-slate-800 border border-slate-700 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm font-medium">Credential loaded</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
            <dt>Jurisdiction</dt>
            <dd className="text-slate-200">{credential.jurisdiction}</dd>
            <dt>Accreditation</dt>
            <dd className="text-slate-200">{credential.accreditation}</dd>
            <dt>Expires</dt>
            <dd className="text-slate-200">
              {new Date(credential.expiry * 1000).toLocaleDateString()}
            </dd>
          </dl>
          <button
            onClick={handleClear}
            className="mt-1 text-xs text-slate-400 hover:text-red-400 transition-colors self-start"
          >
            Remove credential
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-600 p-4 flex flex-col gap-2 items-center">
          <p className="text-slate-400 text-sm text-center">
            Import a credential JSON file issued by your KYC provider.
          </p>
          <label className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium cursor-pointer hover:bg-slate-600 transition-colors">
            Import credential
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImport}
            />
          </label>
          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
