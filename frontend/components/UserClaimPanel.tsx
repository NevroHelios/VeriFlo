"use client";

import { useState } from "react";
import { generateProof } from "@/lib/zk";
import { submitProof } from "@/lib/soroban";
import { parseError, VerifloError } from "@/lib/errors";
import TransactionStatus from "@/components/TransactionStatus";
import CredentialPanel from "@/components/CredentialPanel";
import type { Credential } from "@/lib/credential";
import { loadCredential } from "@/lib/credential";
import { VERIFIER_CONTRACT } from "@/constants";

interface Props {
  publicKey: string | null;
  walletDemo?: boolean;
  onSuccess?: () => void;
}

const MIN_ACCREDITATION = 1;

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function UserClaimPanel({
  publicKey,
  walletDemo = false,
  onSuccess,
}: Props) {
  const [credential, setCredential] = useState<Credential | null>(() => {
    if (typeof window === "undefined") return null;
    return loadCredential();
  });
  const [status, setStatus] = useState<"idle" | "proving" | "pending" | "success" | "error">("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<VerifloError | null>(null);

  async function handleSubmit() {
    if (!publicKey || !credential) return;
    setStatus("proving");
    setHash(null);
    setError(null);
    try {
      const { proofBytes, publicInputs, mode } = await generateProof(
        credential,
        publicKey,
        { allowDemoProof: !VERIFIER_CONTRACT }
      );
      setStatus("pending");
      const txHash = await submitProof(publicKey, proofBytes, publicInputs, mode);
      setHash(txHash);
      setStatus("success");
      onSuccess?.();
    } catch (err) {
      setError(parseError(err));
      setStatus("error");
    }
  }

  const isExpired = credential
    ? credential.expiry <= Math.floor(Date.now() / 1000)
    : false;
  const hasTier = credential
    ? credential.accreditation >= MIN_ACCREDITATION
    : false;
  const eligible = !!credential && !isExpired && hasTier;
  const canSubmit =
    !!publicKey &&
    eligible &&
    status !== "proving" &&
    status !== "pending";

  const checks = [
    {
      label: "Wallet-bound proof",
      value: publicKey ? "Ready" : "No wallet",
      state: publicKey ? "pass" : "idle",
    },
    {
      label: "Credential root",
      value: credential ? "Trusted demo root" : "Missing",
      state: credential ? "pass" : "idle",
    },
    {
      label: "Accreditation",
      value: credential ? `Tier ${credential.accreditation}` : "Missing",
      state: credential ? (hasTier ? "pass" : "fail") : "idle",
    },
    {
      label: "Expiry",
      value: credential ? formatDate(credential.expiry) : "Missing",
      state: credential ? (isExpired ? "fail" : "pass") : "idle",
    },
  ];

  return (
    <div className="panel-stack">
      <div className="section-heading">
        <span className="eyebrow">Investor claim</span>
        <h2>Verify eligibility, then receive the asset</h2>
        <p>
          VeriFlo proves eligibility in the wallet and writes only protocol
          authorization state to Stellar.
        </p>
      </div>

      <div className="claim-grid">
        <CredentialPanel onCredentialChange={setCredential} />

        <div className="proof-card">
          <div className="panel-heading">
            <span className="eyebrow">Proof gate</span>
            <span className="status-pill">
              <span className="live-dot" />
              {VERIFIER_CONTRACT ? "testnet" : walletDemo ? "demo ledger" : "local mvp"}
            </span>
          </div>

          <div className="check-list">
            {checks.map((check) => (
              <div className={`check-row ${check.state}`} key={check.label}>
                <span className="check-dot" />
                <div>
                  <strong>{check.label}</strong>
                  <span>{check.value}</span>
                </div>
              </div>
            ))}
          </div>

          {!publicKey && (
            <p className="notice red">Connect Freighter or use the demo wallet.</p>
          )}
          {publicKey && !credential && (
            <p className="notice purple">Load a credential from the KYC provider.</p>
          )}
          {credential && !eligible && (
            <p className="notice red">
              This credential does not meet the issuer policy.
            </p>
          )}
          {VERIFIER_CONTRACT && credential && eligible && (
            <p className="notice purple">
              Testnet mode accepts real circuit proofs only.
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="button button-primary button-wide"
          >
            {status === "proving"
                ? "Generating proof..."
              : status === "pending"
                ? "Submitting..."
                : "Verify and receive VFLY"}
          </button>

          <TransactionStatus
            hash={hash}
            status={status === "proving" ? "pending" : status}
            error={error}
            explorer={Boolean(VERIFIER_CONTRACT)}
            successLabel="Wallet authorized and asset released"
          />
        </div>
      </div>
    </div>
  );
}
