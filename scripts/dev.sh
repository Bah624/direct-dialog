#!/usr/bin/env sh
# Développement local, sans Docker :
#   - le serveur local (API + données) écoute sur http://127.0.0.1:8787
#   - Vite sert l'interface sur http://localhost:8080 et lui relaie /api
set -e

cd "$(dirname "$0")/.."

echo "→ compilation du serveur local…"
node server/build.mjs

echo "→ démarrage du serveur local (port 8787)…"
PORT=8787 node server/dist/server.mjs &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM

sleep 1
echo "→ démarrage de Vite (port 8080)…"
BACKEND_URL=http://127.0.0.1:8787 yarn workspace @project/adcampaign-manager dev
