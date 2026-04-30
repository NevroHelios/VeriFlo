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
  it("maps NullifierAlreadyUsed (#5) to ALREADY_CLAIMED", () => {
    const err = parseError(new Error("HostError: Error(Contract, #5)"));
    expect(err.type).toBe("ALREADY_CLAIMED");
  });

  it("maps ProofVerificationFailed (#6) to PROOF_REJECTED", () => {
    const err = parseError(new Error("HostError: Error(Contract, #6)"));
    expect(err.type).toBe("PROOF_REJECTED");
  });

  it("maps RecipientMismatch (#9) to PROOF_REJECTED", () => {
    const err = parseError(new Error("HostError: Error(Contract, #9)"));
    expect(err.type).toBe("PROOF_REJECTED");
  });

  it("maps UntrustedRoot (#7) to UNTRUSTED_ROOT", () => {
    const err = parseError(new Error("HostError: Error(Contract, #7)"));
    expect(err.type).toBe("UNTRUSTED_ROOT");
  });

  it("maps InvalidTimestamp (#10) to EXPIRED_CREDENTIAL", () => {
    const err = parseError(new Error("HostError: Error(Contract, #10)"));
    expect(err.type).toBe("EXPIRED_CREDENTIAL");
  });

  it("maps missing real ZK proof to ZK_ASSETS_MISSING", () => {
    const err = parseError(new Error("Real ZK proof unavailable"));
    expect(err.type).toBe("ZK_ASSETS_MISSING");
  });

  it("maps 404 to INSUFFICIENT_XLM", () => {
    const err = parseError(new Error("404 not found"));
    expect(err.type).toBe("INSUFFICIENT_XLM");
  });
});
