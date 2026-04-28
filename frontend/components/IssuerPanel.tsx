"use client";

import { useState } from "react";
import TransactionStatus from "@/components/TransactionStatus";
import { parseError, VerifloError } from "@/lib/errors";
import {
  createDemoCredential,
  saveCredential,
  type Credential,
} from "@/lib/credential";
import { recordAuditEvent } from "@/lib/demoLedger";
import type { RuntimeMode } from "@/lib/runtimeMode";

interface FundState {
  status: "idle" | "pending" | "success" | "error";
  hash: string | null;
  error: VerifloError | null;
}

interface CredentialForm {
  recipientAddress: string;
  jurisdiction: string;
  accreditation: string;
  expiry: string;
}

const INITIAL_FORM: CredentialForm = {
  recipientAddress: "",
  jurisdiction: "840",
  accreditation: "2",
  expiry: "2028-12-31",
};

interface Props {
  runtimeMode: RuntimeMode;
}

function fieldId(key: keyof CredentialForm) {
  return `issuer-${key}`;
}

async function makeLocalHash(input: string): Promise<string> {
  const payload = new TextEncoder().encode(`${input}:${Date.now()}`);

  if (crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", payload);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return Array.from(payload)
    .slice(0, 32)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .padEnd(64, "0");
}

function buildCredential(form: CredentialForm): Credential {
  return createDemoCredential({
    jurisdiction: Number.parseInt(form.jurisdiction, 10),
    accreditation: Number.parseInt(form.accreditation, 10),
    expiry: Math.floor(new Date(form.expiry).getTime() / 1000),
  });
}

export default function IssuerPanel({ runtimeMode }: Props) {
  const [fund, setFund] = useState<FundState>({
    status: "idle",
    hash: null,
    error: null,
  });
  const [form, setForm] = useState<CredentialForm>(INITIAL_FORM);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleFund() {
    setFund({ status: "pending", hash: null, error: null });

    try {
      await new Promise((resolve) => setTimeout(resolve, 650));
      const hash = await makeLocalHash(
        `demo-reserve:${form.recipientAddress || "unassigned"}`
      );

      recordAuditEvent({
        label: "Demo reserve staged",
        detail: "Issuer staged 1,000 VFLY for post-verification release.",
        hash,
        tone: "green",
      });
      setFund({ status: "success", hash, error: null });
    } catch (err) {
      setFund({ status: "error", hash: null, error: parseError(err) });
    }
  }

  function handleGenerateCredential() {
    const nextCredential = buildCredential(form);
    setCredential(nextCredential);
    setSaved(false);
    recordAuditEvent({
      label: "Credential issued",
      detail: `Jurisdiction ${nextCredential.jurisdiction}, tier ${nextCredential.accreditation}, no personal fields stored.`,
      tone: "purple",
    });
  }

  function handleDownload() {
    if (!credential) return;

    const blob = new Blob([JSON.stringify(credential, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "veriflo_credential.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSaveToWallet() {
    if (!credential) return;
    saveCredential(credential);
    setSaved(true);
  }

  const field = (key: keyof CredentialForm) => ({
    id: fieldId(key),
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [key]: e.target.value })),
  });

  return (
    <div className="panel-stack">
      <div className="section-heading">
        <span className="eyebrow">Issuer console</span>
        <h2>Publish policy, stage reserve, issue credential</h2>
        <p>
          The issuer controls eligibility and authorization while the user keeps
          identity material outside the ledger.
        </p>
      </div>

      <div className="issuer-grid">
        <section className="issuer-card">
          <div className="panel-heading">
            <span className="eyebrow">Distribution policy</span>
            <span className="chain-badge stellar">Verifier gated</span>
          </div>

          <div className="form-grid">
            <label className="field full" htmlFor={fieldId("recipientAddress")}>
              <span>User wallet</span>
              <input
                type="text"
                placeholder="G..."
                autoComplete="off"
                className="mono"
                {...field("recipientAddress")}
              />
            </label>

            <label className="field" htmlFor={fieldId("jurisdiction")}>
              <span>Jurisdiction</span>
              <input type="number" min="0" {...field("jurisdiction")} />
            </label>

            <label className="field" htmlFor={fieldId("accreditation")}>
              <span>Tier</span>
              <input type="number" min="0" max="3" {...field("accreditation")} />
            </label>

            <label className="field" htmlFor={fieldId("expiry")}>
              <span>Expiry</span>
              <input type="date" {...field("expiry")} />
            </label>
          </div>
        </section>

        <section className="issuer-card">
          <div className="panel-heading">
            <span className="eyebrow">Distribution reserve</span>
            <span className="status-pill">
              <span className="live-dot" />
              {runtimeMode === "demo" ? "demo reserve" : "manual step"}
            </span>
          </div>

          <div className="asset-breakdown">
            <div>
              <span>Asset</span>
              <strong>VFLY</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong>1,000</strong>
            </div>
            <div>
              <span>Claim rule</span>
              <strong>authorized wallet</strong>
            </div>
          </div>

          <button
            onClick={handleFund}
            disabled={fund.status === "pending"}
            className="button button-primary button-wide"
          >
            {fund.status === "pending" ? "Staging..." : "Stage demo reserve"}
          </button>

          <TransactionStatus
            hash={fund.hash}
            status={fund.status}
            error={fund.error}
            explorer={false}
            successLabel="Demo reserve staged"
          />
        </section>
      </div>

      <section className="issuer-card">
        <div className="panel-heading">
          <span className="eyebrow">Portable credential</span>
          <button onClick={handleGenerateCredential} className="button button-primary">
            Generate demo credential
          </button>
        </div>

        {credential ? (
          <div className="credential-output">
            <pre>{JSON.stringify(credential, null, 2)}</pre>
            <div className="button-row">
              <button onClick={handleSaveToWallet} className="button button-secondary">
                Save to wallet
              </button>
              <button onClick={handleDownload} className="button button-secondary">
                Download JSON
              </button>
            </div>
            {saved && <p className="notice green">Credential saved in this browser.</p>}
          </div>
        ) : (
          <p className="empty-copy">
            Eligibility data is encoded into a reusable proof credential. The
            issuer never stores user documents in this app.
          </p>
        )}
      </section>
    </div>
  );
}
