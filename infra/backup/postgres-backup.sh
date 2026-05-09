#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/pnp/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT="${BACKUP_DIR}/pnp_ops_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"
pg_dump "${DATABASE_URL}" | gzip -9 > "${OUTPUT}"

test -s "${OUTPUT}"
find "${BACKUP_DIR}" -type f -name "pnp_ops_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "backup_created=${OUTPUT}"
