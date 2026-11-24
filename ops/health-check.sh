#!/usr/bin/env bash
set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/v1/health/ready}"
if curl --fail --silent --show-error --max-time 10 "$HEALTH_URL" >/dev/null; then
  exit 0
fi

message="Kafaat backend readiness check failed on $(hostname) at $(date -u +%FT%TZ)"
logger -p daemon.err -t kafaat-health "$message"
if [[ -n "${MONITORING_WEBHOOK_URL:-}" ]]; then
  curl --fail --silent --show-error --max-time 10 \
    -H 'Content-Type: application/json' \
    --data "{\"text\":\"$message\"}" "$MONITORING_WEBHOOK_URL" >/dev/null || true
fi
exit 1

