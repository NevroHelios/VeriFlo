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
    "jurisdiction", "accreditation", "expiry",
    "issuer_id", "nonce", "merkle_root",
    "merkle_siblings", "merkle_path",
  ];
  for (const field of required) {
    if (!(field in parsed)) throw new Error(`Missing field: ${field}`);
  }
  return parsed as Credential;
}
