#!/usr/bin/env bash
# Sauvegarde quotidienne de la base PostgreSQL de SIGEC-SM (section 33).
# A executer via cron (voir docs/BACKUP.md) sur le serveur de production.
#
# Usage : ./scripts/backup.sh
# Variables d'environnement attendues (definies dans /etc/sigec-sm/backup.env
# ou exportees par l'appelant) :
#   DATABASE_URL        - chaine de connexion Postgres (obligatoire)
#   BACKUP_DIR          - dossier local des sauvegardes (defaut: /var/backups/sigec-sm)
#   BACKUP_RETENTION_DAYS - nombre de jours a conserver localement (defaut: 14)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/sigec-sm}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="sigec-sm_${TIMESTAMP}.sql.gz"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERREUR: DATABASE_URL n'est pas defini." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Sauvegarde de la base vers ${BACKUP_DIR}/${FILENAME}..."
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "${BACKUP_DIR}/${FILENAME}"

# Verification minimale : le fichier ne doit pas etre vide.
if [ ! -s "${BACKUP_DIR}/${FILENAME}" ]; then
  echo "ERREUR: la sauvegarde generee est vide, echec probable de pg_dump." >&2
  rm -f "${BACKUP_DIR}/${FILENAME}"
  exit 1
fi

echo "Sauvegarde terminee ($(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1))."

# Purge des sauvegardes locales plus anciennes que RETENTION_DAYS.
# La copie hors site (section "backup externe") est geree separement,
# voir docs/BACKUP.md — ne pas purger avant confirmation de la copie distante.
find "$BACKUP_DIR" -name 'sigec-sm_*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete

echo "Purge des sauvegardes de plus de ${RETENTION_DAYS} jours effectuee."
