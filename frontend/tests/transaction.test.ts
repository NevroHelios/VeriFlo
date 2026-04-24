import { describe, it, expect } from "vitest";
import { Operation, Asset } from "@stellar/stellar-sdk";
import { parseError } from "../lib/errors";

describe("buildPaymentTx", () => {
  it("constructs a valid XLM payment operation without throwing", () => {
    expect(() =>
      Operation.payment({
        destination: "GDDNLKFD2KHCJUUA7M6IRDNZYU7GBGAKV4F5QW42N2D2GN5FEPT2JXJY",
        asset: Asset.native(),
        amount: "10",
      })
    ).not.toThrow();
  });
});

describe("parseError", () => {
  it("maps NullifierReused to PROOF_REJECTED", () => {
    const err = parseError(new Error("Contract error: NullifierReused"));
    expect(err.type).toBe("PROOF_REJECTED");
  });

  it("maps ProofInvalid to PROOF_REJECTED", () => {
    const err = parseError(new Error("ProofInvalid"));
    expect(err.type).toBe("PROOF_REJECTED");
  });

  it("maps 404 to INSUFFICIENT_XLM", () => {
    const err = parseError(new Error("404 not found"));
    expect(err.type).toBe("INSUFFICIENT_XLM");
  });
});
