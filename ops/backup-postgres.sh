#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/kafaat}"
BACKUP_ENV="${BACKUP_ENV:-/etc/kafaat/backup.env}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/kafaat/backend/docker-compose.production.yml}"

umask 077
test -r "$BACKUP_ENV"
# shellcheck disable=SC1090
source "$BACKUP_ENV"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
export BACKUP_ENCRYPTION_KEY

install -d -m 0700 "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/kafaat-postgres-$timestamp.sql.gz.enc"
temporary="$target.partial"
trap 'rm -f -- "$temporary"' EXIT

docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' \
  | gzip -9 \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
      -pass env:BACKUP_ENCRYPTION_KEY -out "$temporary"

test -s "$temporary"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY -in "$temporary" | gzip -t
mv -- "$temporary" "$target"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'kafaat-postgres-*.sql.gz.enc' \
  -mtime +14 -delete
logger -t kafaat-backup "Encrypted PostgreSQL backup completed: $target"

