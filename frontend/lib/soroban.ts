import {
  TransactionBuilder,
  Contract,
  rpc,
  xdr,
  Address,
  scValToNative,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { rpcServer } from "@/lib/stellar";
import { NETWORK_PASSPHRASE, VERIFIER_CONTRACT } from "@/constants";

export async function invokeContract(
  publicKey: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): Promise<{ hash: string; result: unknown }> {
  const account = await rpcServer.getAccount(publicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResult = await rpcServer.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(
      `Simulation failed: ${(simResult as rpc.Api.SimulateTransactionErrorResponse).error}`
    );
  }

  const assembled = rpc.assembleTransaction(tx, simResult).build();

  const signResult = await signTransaction(assembled.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (signResult.error) {
    throw new Error(`Signing rejected: ${signResult.error}`);
  }

  const signed = TransactionBuilder.fromXDR(
    signResult.signedTxXdr,
    NETWORK_PASSPHRASE
  );

  const sendResult = await rpcServer.sendTransaction(signed);
  if (sendResult.status === "ERROR") {
    throw new Error(`Submit failed: ${sendResult.errorResult?.toXDR()}`);
  }

  const hash = sendResult.hash;
  let attempts = 0;
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000));
    const poll = await rpcServer.getTransaction(hash);
    if (poll.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
      if (poll.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
        throw new Error(`Transaction failed: ${poll.status}`);
      }
      const retval = (poll as rpc.Api.GetSuccessfulTransactionResponse)
        .returnValue;
      return { hash, result: retval ? scValToNative(retval) : null };
    }
    attempts++;
  }
  throw new Error("Transaction polling timed out");
}

export async function submitProof(
  publicKey: string,
  proofBytes: Uint8Array,
  publicInputs: Uint8Array[]
): Promise<string> {
  const proofScVal = xdr.ScVal.scvBytes(Buffer.from(proofBytes));

  const pubInputsScVal = xdr.ScVal.scvVec(
    publicInputs.map((inp) =>
      xdr.ScVal.scvBytes(Buffer.from(inp))
    )
  );

  const userScVal = xdr.ScVal.scvAddress(
    Address.fromString(publicKey).toScAddress()
  );

  const { hash } = await invokeContract(
    publicKey,
    VERIFIER_CONTRACT,
    "verify_and_authorize",
    [proofScVal, pubInputsScVal, userScVal]
  );
  return hash;
}
