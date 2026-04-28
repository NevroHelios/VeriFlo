import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
} from "@stellar/stellar-sdk";
import { Horizon } from "@stellar/stellar-sdk";
import { HORIZON_URL, XLM_FUND_AMOUNT, NETWORK_PASSPHRASE } from "@/constants";

const horizonServer = new Horizon.Server(HORIZON_URL);
const fundedAt = new Map<string, number>();
const FUNDING_COOLDOWN_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    if (process.env.ENABLE_TESTNET_FUNDER !== "true") {
      return NextResponse.json(
        { error: "Testnet funder disabled" },
        { status: 403 }
      );
    }

    const { toPublicKey } = await req.json();
    if (!toPublicKey) {
      return NextResponse.json({ error: "toPublicKey required" }, { status: 400 });
    }
    Keypair.fromPublicKey(toPublicKey);

    const previousFunding = fundedAt.get(toPublicKey) ?? 0;
    if (Date.now() - previousFunding < FUNDING_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Funding cooldown active for this address" },
        { status: 429 }
      );
    }

    const secret = process.env.ISSUER_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "ISSUER_SECRET not configured" }, { status: 500 });
    }

    const issuerKeypair = Keypair.fromSecret(secret);
    const issuerAccount = await horizonServer.loadAccount(issuerKeypair.publicKey());

    const tx = new TransactionBuilder(issuerAccount, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: toPublicKey,
          asset: Asset.native(),
          amount: XLM_FUND_AMOUNT,
        })
      )
      .addMemo(Memo.text("VeriFlo fund"))
      .setTimeout(30)
      .build();

    tx.sign(issuerKeypair);
    const result = await horizonServer.submitTransaction(tx);
    fundedAt.set(toPublicKey, Date.now());

    return NextResponse.json({ hash: result.hash });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
