#!/usr/bin/env bash
# Issue a credential, build the Merkle tree, and register the root on the
# VeriFlo verifier — all in one step.
#
# Usage:
#   ./issue-and-register.sh <STELLAR_ADDRESS> [JURISDICTION] [ACCREDITATION] [EXPIRY_UNIX]
#
# Examples:
#   ./issue-and-register.sh GCQDCARW... 356 1 1893456000
#   ./issue-and-register.sh GCQDCARW...                  # uses defaults
#
# Environment overrides:
#   VERIFIER_ID  — VeriFlo verifier contract (default: testnet deployment)
#   SOURCE       — stellar-cli identity used to sign add_trusted_root (default: deployer)
#   NETWORK      — stellar network (default: testnet)

set -euo pipefail

ADDRESS="${1:-}"
JURISDICTION="${2:-356}"
ACCREDITATION="${3:-1}"
EXPIRY="${4:-1893456000}"

VERIFIER_ID="${VERIFIER_ID:-CDGGIZWLIC6SWP2WFCENCB5XWJIJVEQLAU3ZX2OL7N6BCMVVEV5ECAV6}"
SOURCE="${SOURCE:-deployer}"
NETWORK="${NETWORK:-testnet}"

if [[ -z "$ADDRESS" ]]; then
  echo "Usage: $0 <STELLAR_ADDRESS> [JURISDICTION] [ACCREDITATION] [EXPIRY_UNIX]"
  exit 1
fi

cd "$(dirname "$0")"

if [[ ! -f issuer-keypair.json ]]; then
  echo "==> Generating issuer keypair (one-time setup)..."
  node generate-keypair.js
fi

echo "==> Issuing credential for $ADDRESS..."
node issue-credential.js \
  --address "$ADDRESS" \
  --jurisdiction "$JURISDICTION" \
  --accreditation "$ACCREDITATION" \
  --expiry "$EXPIRY"

echo "==> Building Merkle tree..."
node build-merkle-tree.js

ROOT_HEX=$(cat merkle-root.hex)
echo "==> Registering root 0x$ROOT_HEX on verifier $VERIFIER_ID..."
stellar contract invoke \
  --id "$VERIFIER_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  --send=yes \
  -- add_trusted_root \
  --root "$ROOT_HEX"

echo ""
echo "==> Done. Import this file in the Investor panel:"
echo "    scripts/issuer/wallet-credential-${ADDRESS}.json"
