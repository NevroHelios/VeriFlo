"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TransactionBuilder,
  Contract,
  rpc,
  Address,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { horizonServer, rpcServer } from "@/lib/stellar";
import { NETWORK_PASSPHRASE, TOKEN_CONTRACT } from "@/constants";
import { getDemoClaim } from "@/lib/demoLedger";

interface BalanceState {
  xlm: string;
  vfly: string;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBalance(
  publicKey: string | null,
  demoMode = false
): BalanceState {
  const [xlm, setXlm] = useState("0");
  const [vfly, setVfly] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      if (demoMode) {
        const claim = getDemoClaim(publicKey);
        setXlm("100.0000000");
        setVfly(claim?.amount ?? "0.0000000");
        return;
      }

      const account = await horizonServer.loadAccount(publicKey);
      const nativeBal = account.balances.find((b) => b.asset_type === "native");
      setXlm(nativeBal ? nativeBal.balance : "0");

      if (!TOKEN_CONTRACT) {
        setVfly("0");
      } else {
        const sorobanAccount = await rpcServer.getAccount(publicKey);
        const addressScVal = xdr.ScVal.scvAddress(
          Address.fromString(publicKey).toScAddress()
        );

        const contract = new Contract(TOKEN_CONTRACT);
        const tx = new TransactionBuilder(sorobanAccount, {
          fee: "100",
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(contract.call("balance", addressScVal))
          .setTimeout(30)
          .build();

        const sim = await rpcServer.simulateTransaction(tx);
        if (rpc.Api.isSimulationError(sim)) {
          setVfly("0");
        } else {
          const simSuccess = sim as rpc.Api.SimulateTransactionSuccessResponse;
          if (simSuccess.result) {
            const raw = scValToNative(simSuccess.result.retval) as bigint;
            setVfly((Number(raw) / 1e7).toFixed(7));
          } else {
            setVfly("0");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [demoMode, publicKey]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { xlm, vfly, loading, error, refetch: fetchBalances };
}
