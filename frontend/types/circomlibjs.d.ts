declare module "circomlibjs" {
  export function buildPoseidon(): Promise<{
    (inputs: Array<bigint | number | string>): unknown;
    F: {
      toString(value: unknown): string;
    };
  }>;
}
