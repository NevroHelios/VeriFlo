#!/usr/bin/env bash
set -euo pipefail

# Fund one or more Stellar testnet accounts via Friendbot
for ACCOUNT in "$@"; do
  echo "Funding $ACCOUNT..."
  curl -s "https://friendbot.stellar.org?addr=$ACCOUNT" | python3 -c "import sys,json; r=json.load(sys.stdin); print('OK' if 'hash' in r else r)"
done

echo "Done."
