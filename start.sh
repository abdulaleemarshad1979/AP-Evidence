#!/usr/bin/env bash

# Exit on error
set -e

# Change working directory to script location
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "================================================================================="
echo " PALANTIR ENTERPRISE INTELLIGENCE OS (FOUNDRY, GOTHAM, AIP, APOLLO)"
echo " Starting System..."
echo "================================================================================="

# Environment defaults
export PORT="${PORT:-3000}"
export NODE_ENV="${NODE_ENV:-development}"

# Check and install dependencies if missing
if [ ! -d "node_modules" ]; then
  echo "[STARTUP] Installing dependencies..."
  npm install
fi

# Run automated compliance test suite verification
echo "[STARTUP] Running automated compliance test suite..."
npm test

# Launch application server
echo "[STARTUP] Launching Palantir Enterprise Intelligence OS..."
exec node server.js
