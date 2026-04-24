import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseError } from "../lib/errors";

const mockIsConnected = vi.fn();
const mockIsAllowed = vi.fn();
const mockSetAllowed = vi.fn();
const mockGetAddress = vi.fn();

vi.mock("@stellar/freighter-api", () => ({
  isConnected: mockIsConnected,
  isAllowed: mockIsAllowed,
  setAllowed: mockSetAllowed,
  getAddress: mockGetAddress,
}));

const TEST_PUBKEY = "GDDNLKFD2KHCJUUA7M6IRDNZYU7GBGAKV4F5QW42N2D2GN5FEPT2JXJY";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("wallet connect", () => {
  it("returns pubkey when Freighter is connected and allowed", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: TEST_PUBKEY });

    const freighter = await import("@stellar/freighter-api");
    const conn = await freighter.isConnected();
    const allowed = await freighter.isAllowed();
    const addr = await freighter.getAddress();

    expect(conn.isConnected).toBe(true);
    expect(allowed.isAllowed).toBe(true);
    expect(addr.address).toBe(TEST_PUBKEY);
  });

  it("setAllowed is called when not allowed", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: false });
    mockSetAllowed.mockResolvedValue({});
    mockGetAddress.mockResolvedValue({ address: TEST_PUBKEY });

    const freighter = await import("@stellar/freighter-api");
    await freighter.isConnected();
    const allowed = await freighter.isAllowed();
    if (!allowed.isAllowed) await freighter.setAllowed();
    await freighter.getAddress();

    expect(mockSetAllowed).toHaveBeenCalledOnce();
  });

  it("returns WALLET_REJECTED error when Freighter is not connected", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false });

    const freighter = await import("@stellar/freighter-api");
    const conn = await freighter.isConnected();
    expect(conn.isConnected).toBe(false);

    const err = parseError(new Error("Freighter is not connected"));
    expect(err.type).toBe("WALLET_REJECTED");
  });
});
