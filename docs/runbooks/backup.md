# Backup Runbook

## Scope

- PostgreSQL full backup: daily
- Photo storage backup: daily incremental, to be added when file upload is implemented
- Retention: at least 1 year, with local rolling retention configurable by `RETENTION_DAYS`

## PostgreSQL Backup

1. Set `DATABASE_URL`.
2. Set `BACKUP_DIR`, default `/var/backups/pnp/postgres`.
3. Run `infra/backup/postgres-backup.sh`.
4. Verify the generated `.sql.gz` exists and is non-empty.

## Restore Drill

1. Create an empty PostgreSQL database.
2. Decompress the selected backup.
3. Run `psql "$DATABASE_URL" < backup.sql`.
4. Run application smoke tests against `/healthz` and `/api/v1/notification`.

## Security

External copies must be encrypted with AES-256 or stored in an encrypted volume.
