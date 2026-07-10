#!/bin/bash
# E2E del launcher de Quad4Damage (usa el SDK de plataforma play4Chain-sdk/js).
# Levanta el stack minimo y, desde la perspectiva del jugador, registra, hace
# login, obtiene el ticket y genera los args de connect de Quake 3.
set -uo pipefail
export PATH="$HOME/.foundry/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
export DISPLAY=""
ROOT="$HOME/developer/ab4cus/projects/heliomultiverso"
E4="$ROOT/e4Coin-core/src"
CONTRACTS="$ROOT/e4Coin-play4Chain"
AUTH="$ROOT/quad4Damage-auth"
LAUNCHER="$ROOT/quad4Damage/launcher"

T=$(mktemp -d); TICKETS=$(mktemp -d); AUTH_PID=""
DATADIR="$T/e4coin"; mkdir -p "$DATADIR"
cleanup() {
  [ -n "$AUTH_PID" ] && kill "$AUTH_PID" 2>/dev/null || true
  "$E4/e4coin-cli" -regtest -datadir="$DATADIR" stop >/dev/null 2>&1 || true
  pkill -f anvil 2>/dev/null || true
  sleep 2; rm -rf "$T" "$TICKETS" "$AUTH/accounts-launcher.json"
}
trap cleanup EXIT

echo "=== 1. stack minimo (L1 + L2 + deploy + auth) ==="
"$E4/e4coind" -regtest -datadir="$DATADIR" -daemon >/dev/null; sleep 4
pkill -f anvil 2>/dev/null; sleep 1
anvil --port 8545 > /tmp/anvil.log 2>&1 &
sleep 4
cd "$CONTRACTS"; rm -f deploy.json
forge script script/DeployAndWire.s.sol:DeployAndWire --rpc-url http://127.0.0.1:8545 --broadcast > /tmp/deploy.log 2>&1
cp deploy.json "$T/deploy.json"
IDREG=$(grep -oE '"identityRegistry": *"0x[0-9a-fA-F]+"' deploy.json | grep -oE '0x[0-9a-fA-F]+')
"$E4/e4coin-cli" -regtest -datadir="$DATADIR" createwallet smoke >/dev/null

cd "$AUTH"
E4COIND_RPC_URL="http://127.0.0.1:17839" E4COIND_COOKIE="$DATADIR/regtest/.cookie" \
QD_TICKET_DIR="$TICKETS" QD_ACCOUNTS_FILE="$AUTH/accounts-launcher.json" QD_SECRET="launcher-e2e" \
L2_RPC_URL="http://127.0.0.1:8545" IDENTITY_REGISTRY="$IDREG" \
FEDERATION_PK="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" \
  node src/server.mjs > /tmp/auth.log 2>&1 & AUTH_PID=$!
sleep 1.5

echo "=== 2. LAUNCHER de Quad4Damage (usa play4Chain-sdk) ==="
cd "$LAUNCHER"
QD_RUN="$T" E4COIN_CLI="$E4/e4coin-cli" node examples/launch.mjs 1.2.3.4:27960
