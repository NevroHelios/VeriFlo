import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/stellar", () => ({
  horizonServer: {
    loadAccount: vi.fn(),
  },
  rpcServer: {},
}));

const FUNDED_ACCOUNT = {
  balances: [
    { asset_type: "native", balance: "100.0000000" },
  ],
};

describe("XLM balance fetch", () => {
  it("returns native balance for a valid account", async () => {
    const { horizonServer } = await import("../lib/stellar");
    vi.mocked(horizonServer.loadAccount).mockResolvedValue(FUNDED_ACCOUNT as never);

    const account = await horizonServer.loadAccount("G...");
    const native = account.balances.find((b) => b.asset_type === "native");
    expect(native?.balance).toBe("100.0000000");
  });

  it("throws for an unfunded (404) account", async () => {
    const { horizonServer } = await import("../lib/stellar");
    vi.mocked(horizonServer.loadAccount).mockRejectedValue(
      new Error("not found")
    );

    await expect(horizonServer.loadAccount("G...")).rejects.toThrow("not found");
  });
});
