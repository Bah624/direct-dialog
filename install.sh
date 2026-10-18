#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# DIRECT DIALOG — installation en une commande
#
#   curl -fsSL https://raw.githubusercontent.com/Bah624/direct-dialog/main/install.sh | sh
#
# Options (à placer après `sh -s --`) :
#   --dir <chemin>   dossier d'installation       (défaut : ./direct-dialog)
#   --port <port>    port d'exposition HTTP        (défaut : 8080)
#   --ref <ref>      branche ou tag à installer    (défaut : main)
#   --image <ref>    image Docker déjà publiée     (défaut : construction locale)
#
# Exemple :
#   curl -fsSL .../install.sh | sh -s -- --dir /opt/direct-dialog --port 8090
# ---------------------------------------------------------------------------
set -eu

REPO="${DIRECT_DIALOG_REPO:-Bah624/direct-dialog}"
REF="main"
DIR="./direct-dialog"
PORT="8080"
IMAGE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    --image) IMAGE="$2"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; exit 1 ;;
  esac
done

say() { printf '  %s\n' "$*"; }
fail() { printf '\n✖ %s\n' "$*" >&2; exit 1; }

printf '\n━━━ DIRECT DIALOG — installation ━━━\n\n'

# --- pré-requis -------------------------------------------------------------
command -v docker >/dev/null 2>&1 || fail "Docker n'est pas installé. Voir https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1 || fail "Le démon Docker n'est pas démarré."

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  fail "Docker Compose est introuvable."
fi
say "Docker et Compose détectés."

# --- récupération du code ---------------------------------------------------
mkdir -p "$DIR"
DIR="$(cd "$DIR" && pwd)"

if [ -n "$IMAGE" ]; then
  say "Utilisation de l'image publiée : $IMAGE"
  cat > "$DIR/docker-compose.yml" <<EOF
name: direct-dialog
services:
  app:
    image: $IMAGE
    container_name: direct-dialog
    ports:
      - "$PORT:8080"
    environment:
      PORT: "8080"
      APP_URL: "http://localhost:$PORT"
    volumes:
      - app-data:/app/data
    restart: unless-stopped
volumes:
  app-data:
    name: direct-dialog-data
EOF
else
  say "Téléchargement de $REPO ($REF)…"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  URL="https://github.com/$REPO/archive/refs/heads/$REF.tar.gz"
  # Une référence qui n'est pas une branche est traitée comme un tag.
  curl -fsSL "$URL" -o "$TMP/src.tar.gz" 2>/dev/null \
    || curl -fsSL "https://github.com/$REPO/archive/refs/tags/$REF.tar.gz" -o "$TMP/src.tar.gz" \
    || fail "Téléchargement impossible ($REPO @ $REF)."

  tar xzf "$TMP/src.tar.gz" -C "$TMP"
  SRC="$(find "$TMP" -maxdepth 1 -mindepth 1 -type d | head -n 1)"
  [ -n "$SRC" ] || fail "Archive invalide."

  # Mise à jour : on remplace le code, les données restent dans le volume Docker.
  find "$DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -R "$SRC"/. "$DIR"/
  say "Code installé dans $DIR"
fi

# --- démarrage --------------------------------------------------------------
cd "$DIR"
say "Construction et démarrage (la première fois : quelques minutes)…"
if [ -n "$IMAGE" ]; then
  DIRECT_DIALOG_PORT="$PORT" $COMPOSE up -d --no-build
else
  DIRECT_DIALOG_PORT="$PORT" $COMPOSE up -d --build
fi

# --- vérification -----------------------------------------------------------
printf '  Attente du démarrage'
i=0
while [ $i -lt 60 ]; do
  if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
    printf '\n\n✔ DIRECT DIALOG est en ligne : http://localhost:%s\n' "$PORT"
    printf '  Données : volume Docker « direct-dialog-data »\n'
    printf '  Arrêt : docker compose -f %s/docker-compose.yml down\n\n' "$DIR"
    exit 0
  fi
  printf '.'
  sleep 2
  i=$((i + 1))
done

printf '\n\n✖ Le service ne répond pas. Journaux :\n'
$COMPOSE logs --tail 30 || true
fail "Installation incomplète."
