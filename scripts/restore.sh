#!/usr/bin/env bash
# Restauration d'une sauvegarde SIGEC-SM (section 33). A tester
# regulierement sur un environnement de verification, PAS sur la
# production, sauf en cas de sinistre reel confirme.
#
# Usage : ./scripts/restore.sh <chemin_vers_sauvegarde.sql.gz> <DATABASE_URL_cible>

set -euo pipefail

BACKUP_FILE="${1:-}"
TARGET_DB_URL="${2:-}"

if [ -z "$BACKUP_FILE" ] || [ -z "$TARGET_DB_URL" ]; then
  echo "Usage: $0 <sauvegarde.sql.gz> <DATABASE_URL_cible>" >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERREUR: fichier de sauvegarde introuvable : $BACKUP_FILE" >&2
  exit 1
fi

echo "⚠ Cette operation va REMPLACER le contenu de la base cible."
echo "  Cible : ${TARGET_DB_URL%%@*}@***"
read -r -p "Confirmer la restauration ? (taper 'oui' pour continuer) " CONFIRM
if [ "$CONFIRM" != "oui" ]; then
  echo "Annule."
  exit 1
fi

echo "Restauration en cours..."
gunzip -c "$BACKUP_FILE" | psql "$TARGET_DB_URL"

echo "Restauration terminee. Verifiez l'integrite des donnees avant de basculer le trafic."
