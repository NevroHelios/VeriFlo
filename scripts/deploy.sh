#!/usr/bin/env bash
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-deployer}"
MINT_AMOUNT="${MINT_AMOUNT:-1000000000}"
TRUSTED_ROOT_HEX="${TRUSTED_ROOT_HEX:-}"

export PATH="$HOME/.cargo/bin:$PATH"

echo "==> Building contracts..."
(cd contracts/vfly-token && stellar contract build)
(cd contracts/kyc-verifier && stellar contract build)
(cd contracts/veriflo-verifier && stellar contract build)

echo "==> Deploying vfly-token..."
TOKEN_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/vfly_token.wasm \
  --source "$SOURCE" \
  --network "$NETWORK")
echo "TOKEN_ID: $TOKEN_ID"

echo "==> Deploying kyc-verifier..."
KYC_VERIFIER_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/kyc_verifier.wasm \
  --source "$SOURCE" \
  --network "$NETWORK")
echo "KYC_VERIFIER_ID: $KYC_VERIFIER_ID"

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
  --admin "$SOURCE" \
  --token_contract "$TOKEN_ID" \
  --kyc_verifier "$KYC_VERIFIER_ID" \
  --mint_amount "$MINT_AMOUNT"

if [[ -n "$TRUSTED_ROOT_HEX" ]]; then
  echo "==> Registering trusted credential root..."
  stellar contract invoke \
    --id "$VERIFIER_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- add_trusted_root \
    --root "$TRUSTED_ROOT_HEX"
else
  echo "==> Skipping trusted root registration."
  echo "    Set TRUSTED_ROOT_HEX=<32-byte-root-hex> before running this script,"
  echo "    or register one later with add_trusted_root."
fi

echo ""
echo "==> Add the following to frontend/.env.local:"
echo "NEXT_PUBLIC_TOKEN_CONTRACT=$TOKEN_ID"
echo "NEXT_PUBLIC_KYC_VERIFIER_CONTRACT=$KYC_VERIFIER_ID"
echo "NEXT_PUBLIC_VERIFIER_CONTRACT=$VERIFIER_ID"
echo ""
echo "# Optional server-only demo funder. Keep disabled unless you need it."
echo "ENABLE_TESTNET_FUNDER=false"
echo "# ISSUER_SECRET=S..."
