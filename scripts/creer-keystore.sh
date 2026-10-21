#!/usr/bin/env bash
# Crée la clé de signature Android pour Google Play.
# À exécuter sur une machine avec Java (ou dans le conteneur de build).
set -euo pipefail

FICHIER="${1:-direct-dialog-release.jks}"
ALIAS="${2:-direct-dialog}"

if [ -e "$FICHIER" ]; then
  echo "Le fichier $FICHIER existe déjà — rien à faire."
  exit 0
fi

read -r -p "Mot de passe du magasin (8 caractères min) : " -s MOT_DE_PASSE
echo
read -r -p "Confirmer le mot de passe : " -s CONFIRMATION
echo
[ "$MOT_DE_PASSE" = "$CONFIRMATION" ] || { echo "Les mots de passe ne correspondent pas."; exit 1; }

keytool -genkeypair -v \
  -keystore "$FICHIER" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$MOT_DE_PASSE" -keypass "$MOT_DE_PASSE" \
  -dname "CN=DIRECT DIALOG, OU=Mobile, O=DIRECT DIALOG, L=Conakry, C=GN"

echo
echo "Clé créée : $FICHIER (alias $ALIAS)"
echo "Pour GitHub, ajoutez ces secrets :"
echo "  ANDROID_KEYSTORE_BASE64 = $(base64 < "$FICHIER" | tr -d '\\n' | head -c 40)..."
echo "  ANDROID_KEYSTORE_PASSWORD = (le mot de passe choisi)"
echo "  ANDROID_KEY_ALIAS = $ALIAS"
echo "  ANDROID_KEY_PASSWORD = (le mot de passe choisi)"
echo
echo "Commande pour obtenir la valeur base64 complète :"
echo "  base64 < $FICHIER | tr -d '\\n'"
