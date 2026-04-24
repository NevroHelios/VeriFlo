import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  Networks,
} from "@stellar/stellar-sdk";
import { Horizon } from "@stellar/stellar-sdk";
import { HORIZON_URL, XLM_FUND_AMOUNT, NETWORK_PASSPHRASE } from "@/constants";

const horizonServer = new Horizon.Server(HORIZON_URL);

export async function POST(req: NextRequest) {
  try {
    const { toPublicKey } = await req.json();
    if (!toPublicKey) {
      return NextResponse.json({ error: "toPublicKey required" }, { status: 400 });
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

    return NextResponse.json({ hash: result.hash });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
