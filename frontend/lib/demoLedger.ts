"use client";

const NULLIFIERS_KEY = "veriflo:mvp:nullifiers";
const CLAIMS_KEY = "veriflo:mvp:claims";
const AUDIT_KEY = "veriflo:mvp:audit";

export const DEMO_PUBLIC_KEY =
  "GDDNLKFD2KHCJUUA7M6IRDNZYU7GBGAKV4F5QW42N2D2GN5FEPT2JXJY";

export interface DemoClaim {
  publicKey: string;
  amount: string;
  hash: string;
  claimedAt: number;
  nullifier: string;
}

export interface AuditEvent {
  id: string;
  label: string;
  detail: string;
  hash?: string;
  timestamp: number;
  tone: "teal" | "red" | "purple" | "green" | "blue";
}

const DEFAULT_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "policy-published",
    label: "Issuer policy published",
    detail: "US residency, accredited investor tier 1+, verifier-gated VFLY.",
    timestamp: Date.now() - 1000 * 60 * 34,
    tone: "purple",
  },
  {
    id: "root-trusted",
    label: "Credential root trusted",
    detail: "KYC provider Merkle root registered with verifier contract.",
    timestamp: Date.now() - 1000 * 60 * 21,
    tone: "teal",
  },
  {
    id: "balance-funded",
    label: "Demo reserve funded",
    detail: "1,000 VFLY staged for release after verifier authorization.",
    timestamp: Date.now() - 1000 * 60 * 9,
    tone: "green",
  },
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function digestHex(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
  }

  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(64, "0");
}

function getNullifiers(): string[] {
  return readJson<string[]>(NULLIFIERS_KEY, []);
}

function setNullifiers(nullifiers: string[]): void {
  writeJson(NULLIFIERS_KEY, nullifiers);
}

export function getDemoClaim(publicKey: string | null): DemoClaim | null {
  if (!publicKey) return null;
  const claims = readJson<Record<string, DemoClaim>>(CLAIMS_KEY, {});
  return claims[publicKey] ?? null;
}

function setDemoClaim(claim: DemoClaim): void {
  const claims = readJson<Record<string, DemoClaim>>(CLAIMS_KEY, {});
  claims[claim.publicKey] = claim;
  writeJson(CLAIMS_KEY, claims);
}

export function getAuditEvents(): AuditEvent[] {
  const customEvents = readJson<AuditEvent[]>(AUDIT_KEY, []);
  return [...customEvents, ...DEFAULT_AUDIT_EVENTS].sort(
    (a, b) => b.timestamp - a.timestamp
  );
}

export function recordAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">) {
  const events = readJson<AuditEvent[]>(AUDIT_KEY, []);
  events.unshift({
    ...event,
    id: `${event.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    timestamp: Date.now(),
  });
  writeJson(AUDIT_KEY, events.slice(0, 12));
}

export async function recordDemoClaim(
  publicKey: string,
  nullifierBytes: Uint8Array,
  proofBytes: Uint8Array,
  publicInputs: Uint8Array[]
): Promise<string> {
  const nullifier = bytesToHex(nullifierBytes);
  const nullifiers = getNullifiers();

  if (nullifiers.includes(nullifier)) {
    throw new Error("NullifierReused");
  }

  const hash = await digestHex(
    [
      "veriflo-demo-claim",
      publicKey,
      nullifier,
      bytesToHex(proofBytes.slice(0, 32)),
      publicInputs.map(bytesToHex).join(":"),
      Date.now().toString(),
    ].join(":")
  );

  setNullifiers([...nullifiers, nullifier]);
  setDemoClaim({
    publicKey,
    amount: "1000.0000000",
    hash,
    claimedAt: Date.now(),
    nullifier,
  });

  recordAuditEvent({
    label: "Proof verified and claimed",
    detail: "Wallet authorized, nullifier consumed, VFLY released.",
    hash,
    tone: "blue",
  });

  return hash;
}
