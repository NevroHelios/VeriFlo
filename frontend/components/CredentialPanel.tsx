"use client";

import { useRef, useState } from "react";
import {
  clearCredential,
  createDemoCredential,
  loadCredential,
  parseCredentialFile,
  saveCredential,
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

  function handleDemoCredential() {
    const cred = createDemoCredential();
    saveCredential(cred);
    setCredential(cred);
    onCredentialChange(cred);
    setError(null);
  }

  return (
    <div className="credential-card">
      <div className="panel-heading">
        <span className="eyebrow">ZK credential</span>
        <span className={credential ? "status-pill" : "status-pill muted"}>
          <span className="live-dot" />
          {credential ? "loaded" : "empty"}
        </span>
      </div>

      {credential ? (
        <div className="credential-loaded">
          <dl className="data-grid">
            <div>
              <dt>Jurisdiction</dt>
              <dd>{credential.jurisdiction}</dd>
            </div>
            <div>
              <dt>Accreditation</dt>
              <dd>Tier {credential.accreditation}</dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>{new Date(credential.expiry * 1000).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt>Issuer</dt>
              <dd>{credential.issuer_id}</dd>
            </div>
          </dl>

          <div>
            <span className="eyebrow">Merkle root</span>
            <p className="hash-text">{credential.merkle_root}</p>
          </div>

          <button onClick={handleClear} className="button button-secondary">
            Remove credential
          </button>
        </div>
      ) : (
        <div className="empty-credential">
          <p>
            Portable eligibility file from a bank, government portal, or KYC
            provider.
          </p>
          <div className="button-row">
            <label className="button button-primary file-button">
              Import credential
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={handleImport}
              />
            </label>
            <button
              onClick={handleDemoCredential}
              className="button button-secondary"
            >
              Demo credential
            </button>
          </div>
          {error && <p className="inline-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
