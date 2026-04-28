import { beforeEach, describe, expect, it } from "vitest";
import {
  getDemoClaim,
  recordDemoClaim,
  resetDemoLedger,
} from "../lib/demoLedger";

const USER =
  "GDDNLKFD2KHCJUUA7M6IRDNZYU7GBGAKV4F5QW42N2D2GN5FEPT2JXJY";

function bytes(seed: number) {
  return Uint8Array.from({ length: 32 }, (_, index) => (seed + index) % 256);
}

describe("demo ledger", () => {
  beforeEach(() => {
    resetDemoLedger();
  });

  it("records a local claim for the connected wallet", async () => {
    const hash = await recordDemoClaim(USER, bytes(1), bytes(2), [bytes(1)]);

    expect(hash).toHaveLength(64);
    expect(getDemoClaim(USER)?.amount).toBe("1000.0000000");
  });

  it("blocks a second claim for the same wallet", async () => {
    await recordDemoClaim(USER, bytes(1), bytes(2), [bytes(1)]);

    await expect(
      recordDemoClaim(USER, bytes(9), bytes(3), [bytes(9)])
    ).rejects.toThrow("AlreadyAuthorized");
  });
});
