import { Horizon, SorobanRpc } from "@stellar/stellar-sdk";
import { HORIZON_URL, SOROBAN_RPC_URL } from "@/constants";

export const horizonServer = new Horizon.Server(HORIZON_URL);
export const rpcServer = new SorobanRpc.Server(SOROBAN_RPC_URL);
