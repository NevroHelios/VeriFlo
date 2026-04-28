const STORAGE_KEY = "veriflo:credential";

export interface Credential {
  jurisdiction: number;
  accreditation: number;
  expiry: number;
  issuer_id: string;
  nonce: string;
  merkle_root: string;
  merkle_siblings: string[];
  merkle_path: number[];
}

export const DEMO_MERKLE_ROOT = "aa".repeat(32);

function randomHex(bytes: number): string {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  return Array.from({ length: bytes }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
  ).join("");
}

export function createDemoCredential(
  overrides: Partial<Credential> = {}
): Credential {
  const expiry =
    overrides.expiry ?? Math.floor(new Date("2028-12-31").getTime() / 1000);

  return {
    jurisdiction: overrides.jurisdiction ?? 840,
    accreditation: overrides.accreditation ?? 2,
    expiry,
    issuer_id: overrides.issuer_id ?? "1001",
    nonce: overrides.nonce ?? randomHex(16),
    merkle_root: overrides.merkle_root ?? DEMO_MERKLE_ROOT,
    merkle_siblings:
      overrides.merkle_siblings ?? Array<string>(20).fill("00".repeat(32)),
    merkle_path: overrides.merkle_path ?? Array<number>(20).fill(0),
  };
}

export function saveCredential(cred: Credential): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cred));
}

export function loadCredential(): Credential | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Credential;
  } catch {
    return null;
  }
}

export function clearCredential(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function parseCredentialFile(text: string): Credential {
  const parsed = JSON.parse(text);
  const required = [
    "jurisdiction",
    "accreditation",
    "expiry",
    "issuer_id",
    "nonce",
    "merkle_root",
    "merkle_siblings",
    "merkle_path",
  ];
  for (const field of required) {
    if (!(field in parsed)) throw new Error(`Missing field: ${field}`);
  }
  return parsed as Credential;
}
