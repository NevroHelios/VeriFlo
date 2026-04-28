"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import WalletButton from "@/components/WalletButton";
import BalanceDisplay from "@/components/BalanceDisplay";
import IssuerPanel from "@/components/IssuerPanel";
import UserClaimPanel from "@/components/UserClaimPanel";
import { getAuditEvents } from "@/lib/demoLedger";
import {
  KYC_VERIFIER_CONTRACT,
  TOKEN_CONTRACT,
  VERIFIER_CONTRACT,
} from "@/constants";

type Tab = "claim" | "issuer" | "audit";

const NAV_ITEMS: Array<{ id: Tab; label: string }> = [
  { id: "claim", label: "Investor" },
  { id: "issuer", label: "Issuer" },
  { id: "audit", label: "Audit" },
];

const STATS = [
  { value: "0", label: "identity fields stored" },
  { value: "3", label: "protocol gates" },
  { value: "<5s", label: "target settlement" },
  { value: "1", label: "atomic claim" },
];

function ContractCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="contract-card">
      <span className="eyebrow">{label}</span>
      <span className="hash-text">{value || "local mvp mode"}</span>
    </div>
  );
}

export default function AppShell() {
  const [tab, setTab] = useState<Tab>("claim");
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const wallet = useWallet();
  const auditEvents = getAuditEvents();

  function handleClaimSuccess() {
    setLedgerVersion((version) => version + 1);
  }

  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <span className="brand-mark">VF</span>
            <div>
              <p className="brand-name">VeriFlo</p>
              <p className="brand-subtitle">Compliant asset distribution on Stellar</p>
            </div>
          </div>

          <nav className="nav-pills" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={tab === item.id ? "nav-pill active" : "nav-pill"}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="topbar-actions">
            {wallet.connected && (
              <BalanceDisplay
                publicKey={wallet.publicKey}
                demo={wallet.demo}
                refreshKey={ledgerVersion}
              />
            )}
            <WalletButton
              publicKey={wallet.publicKey}
              connected={wallet.connected}
              connecting={wallet.connecting}
              demo={wallet.demo}
              error={wallet.error}
              connect={wallet.connect}
              connectDemo={wallet.connectDemo}
              disconnect={wallet.disconnect}
            />
          </div>
        </div>
      </header>

      <main className="page-shell">
        <section className="hero-grid" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="badge-row">
              <span className="chain-badge stellar">Stellar Protocol 25</span>
              <span className="chain-badge ethereum">No identity custody</span>
            </div>
            <h1 id="hero-title">VeriFlo</h1>
            <p className="hero-text">
              ZK credentials let issuers authorize regulated asset access
              without collecting passports, IDs, or counterparty databases.
            </p>
          </div>

          <aside className="protocol-panel" aria-label="Protocol flow">
            <div className="panel-heading">
              <span className="eyebrow">Live flow</span>
              <span className="status-pill"><span className="live-dot" />MVP ready</span>
            </div>
            <ol className="flow-list">
              <li>
                <span>01</span>
                <p>KYC provider issues reusable ZK credential.</p>
              </li>
              <li>
                <span>02</span>
                <p>Soroban verifier checks proof and nullifier.</p>
              </li>
              <li>
                <span>03</span>
                <p>Verifier authorizes the wallet and releases VFLY.</p>
              </li>
            </ol>
          </aside>
        </section>

        <section className="stats-grid" aria-label="VeriFlo metrics">
          {STATS.map((stat) => (
            <div className="stat-card" key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>

        <section className="workspace-grid">
          <div className="workspace-main">
            {tab === "claim" && (
              <UserClaimPanel
                publicKey={wallet.publicKey}
                walletDemo={wallet.demo}
                onSuccess={handleClaimSuccess}
              />
            )}
            {tab === "issuer" && <IssuerPanel />}
            {tab === "audit" && (
              <div className="panel-stack">
                <div className="section-heading">
                  <span className="eyebrow">Audit stream</span>
                  <h2>Compliance events without user identity data</h2>
                  <p>
                    Every event is keyed by protocol state: credential root,
                    nullifier, wallet authorization, or release hash.
                  </p>
                </div>

                <div className="audit-list">
                  {auditEvents.map((event) => (
                    <article className="audit-card" key={event.id}>
                      <span className={`audit-dot ${event.tone}`} />
                      <div>
                        <div className="audit-title-row">
                          <h3>{event.label}</h3>
                          <time>
                            {new Date(event.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                        <p>{event.detail}</p>
                        {event.hash && (
                          <span className="hash-text">{event.hash}</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="workspace-side" aria-label="Protocol state">
            <div className="side-section">
              <span className="eyebrow">Asset rail</span>
              <h2>Verifier-admin VFLY</h2>
              <p>
                The MVP uses a Soroban token with verifier-controlled
                authorization and minting.
              </p>
              <div className="mini-grid">
                <span>Groth16 KYC</span>
                <span>Nullifier lock</span>
                <span>set_authorized</span>
              </div>
            </div>

            <div className="side-section">
              <span className="eyebrow">Contracts</span>
              <ContractCard label="Token contract" value={TOKEN_CONTRACT} />
              <ContractCard label="KYC verifier" value={KYC_VERIFIER_CONTRACT} />
              <ContractCard label="Verifier contract" value={VERIFIER_CONTRACT} />
            </div>

            <div className="side-section compact">
              <span className="eyebrow">Privacy invariant</span>
              <p className="big-statement">No name. No ID number. No document upload.</p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
