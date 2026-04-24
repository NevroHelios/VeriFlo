#!/usr/bin/env bash
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-deployer}"
MINT_AMOUNT="${MINT_AMOUNT:-1000000000}"

export PATH="$HOME/.cargo/bin:$PATH"

echo "==> Building contracts..."
(cd contracts/vfly-token && stellar contract build)
(cd contracts/veriflo-verifier && stellar contract build)

echo "==> Deploying vfly-token..."
TOKEN_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/vfly_token.wasm \
  --source "$SOURCE" \
  --network "$NETWORK")
echo "TOKEN_ID: $TOKEN_ID"

echo "==> Deploying veriflo-verifier..."
VERIFIER_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/veriflo_verifier.wasm \
  --source "$SOURCE" \
  --network "$NETWORK")
echo "VERIFIER_ID: $VERIFIER_ID"

echo "==> Initializing vfly-token (admin = verifier)..."
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$VERIFIER_ID" \
  --decimals 7 \
  --name "VeriFlo" \
  --symbol "VFLY"

echo "==> Initializing veriflo-verifier..."
stellar contract invoke \
  --id "$VERIFIER_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- initialize \
  --token_contract "$TOKEN_ID" \
  --mint_amount "$MINT_AMOUNT"

echo ""
echo "==> Add the following to frontend/.env.local:"
echo "NEXT_PUBLIC_TOKEN_CONTRACT=$TOKEN_ID"
echo "NEXT_PUBLIC_VERIFIER_CONTRACT=$VERIFIER_ID"
