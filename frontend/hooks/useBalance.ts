"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TransactionBuilder,
  SorobanRpc,
  xdr,
  Address,
  scValToNative,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { horizonServer, rpcServer } from "@/lib/stellar";
import { NETWORK_PASSPHRASE, TOKEN_CONTRACT } from "@/constants";

interface BalanceState {
  xlm: string;
  vfly: string;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBalance(publicKey: string | null): BalanceState {
  const [xlm, setXlm] = useState("0");
  const [vfly, setVfly] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      // XLM balance via Horizon
      const account = await horizonServer.loadAccount(publicKey);
      const nativeBal = account.balances.find((b) => b.asset_type === "native");
      setXlm(nativeBal ? nativeBal.balance : "0");

      // VFLY balance via Soroban simulate
      if (!TOKEN_CONTRACT) {
        setVfly("0");
      } else {
        const sorobanAccount = await rpcServer.getAccount(publicKey);
        const addressScVal = nativeToScVal(Address.fromString(publicKey), {
          type: "address",
        });

        const tx = new TransactionBuilder(sorobanAccount, {
          fee: "100",
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            xdr.Operation.fromXDR(
              xdr.OperationBody.invokeHostFunction(
                new xdr.InvokeHostFunctionOp({
                  hostFunction: xdr.HostFunction.hostFunctionTypeInvokeContract(
                    new xdr.InvokeContractArgs({
                      contractAddress: Address.fromString(
                        TOKEN_CONTRACT
                      ).toScAddress(),
                      functionName: "balance",
                      args: [addressScVal],
                    })
                  ),
                  auth: [],
                })
              ).toXDR()
            )
          )
          .setTimeout(30)
          .build();

        const sim = await rpcServer.simulateTransaction(tx);
        if (SorobanRpc.Api.isSimulationError(sim)) {
          setVfly("0");
        } else {
          const result = (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse)
            .result;
          if (result) {
            const raw = scValToNative(result.retval) as bigint;
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
  }, [publicKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { xlm, vfly, loading, error, refetch: fetch };
}
