export function generateMockProof(publicKey: string): Uint8Array {
  const encoder = new TextEncoder();
  const base = encoder.encode(`veriflo:proof:${publicKey}`);
  const padding = new Uint8Array(32).fill(0xab);
  const result = new Uint8Array(base.length + padding.length);
  result.set(base, 0);
  result.set(padding, base.length);
  return result;
}
