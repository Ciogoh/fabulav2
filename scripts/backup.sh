#!/usr/bin/env bash
# Backup giornaliero verso OneDrive: dump del database + cartella foto.
# Non attivo di default — va schedulato a mano via cron dopo aver configurato
# il remote rclone. Vedi "Backup automatico" in CLAUDE.md.

set -euo pipefail

RCLONE_REMOTE="${RCLONE_REMOTE:-onedrive}"
RCLONE_BASE_PATH="${RCLONE_BASE_PATH:-Fabula-backup}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

cd "$(dirname "$0")/.."

set -a
source .env
set +a

mkdir -p data/backup-tmp

timestamp="$(date +%F)"
dump_file="data/backup-tmp/fabula-db-${timestamp}.sql.gz"

docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$dump_file"

rclone copy "$dump_file" "${RCLONE_REMOTE}:${RCLONE_BASE_PATH}/database/"
rm "$dump_file"

# Retention solo sui dump: le foto non si cancellano mai lato OneDrive, una
# cancellazione locale per errore non deve mai propagarsi al backup.
rclone delete --min-age "${RETENTION_DAYS}d" "${RCLONE_REMOTE}:${RCLONE_BASE_PATH}/database/"

rclone copy data/uploads "${RCLONE_REMOTE}:${RCLONE_BASE_PATH}/uploads/"
