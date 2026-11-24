#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/kafaat}"
BACKUP_ENV="${BACKUP_ENV:-/etc/kafaat/backup.env}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/kafaat/backend/docker-compose.production.yml}"
backup="${1:-$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'kafaat-postgres-*.sql.gz.enc' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)}"
test -n "$backup"
test -r "$backup"
# shellcheck disable=SC1090
source "$BACKUP_ENV"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
export BACKUP_ENCRYPTION_KEY

database="kafaat_restore_check_$(date -u +%s)"
cleanup() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c \
    'dropdb -U "$POSTGRES_USER" --if-exists "$1"' sh "$database" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c \
  'createdb -U "$POSTGRES_USER" "$1"' sh "$database"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY -in "$backup" \
  | gzip -d \
  | docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c \
      'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"' sh "$database" >/dev/null
docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$1" -Atc "SELECT count(*) FROM schema_migrations"' \
  sh "$database" | grep -Eq '^[1-9][0-9]*$'
logger -t kafaat-backup "PostgreSQL restore drill succeeded: $backup"

