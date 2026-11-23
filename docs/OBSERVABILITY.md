# Errors and observability

## Structured logs

`nestjs-pino` emits JSON in production and readable single-line output in development. Every request receives or preserves `x-request-id`; the same value appears in responses, logs, and error envelopes.

The logger redacts authorization headers, Bunny webhook signatures, passwords, password hashes, API keys, generated upload signatures, and Jitsi join JWTs. Do not log provider credentials or complete provider response bodies.

## Metrics and probes

- `/api/v1/health/live`: restart only when this fails.
- `/api/v1/health/ready`: remove instance from traffic when PostgreSQL fails.
- `/api/v1/metrics`: Prometheus process metrics plus HTTP request count and duration.

Recommended alerts: readiness failure for two minutes; HTTP 5xx over 2% for five minutes; p95 API latency over one second; unusual Bunny provider or webhook-signature failures; repeated `LIVE_PROVIDER_NOT_CONFIGURED`; missing completion webhook after an upload; PostgreSQL connection saturation or disk pressure. Monitor the Jitsi containers, UDP/10000 reachability, and room-join failures from browser telemetry separately.

## Error handling

Validation, authentication, authorization, conflicts, subscription access, provider failures, database connectivity, and unexpected errors are normalized by the global exception filter. PostgreSQL `23505`, `23503`, `22P02`, and connection failures have separate HTTP mappings. Internal stack traces and provider bodies are logged server-side but never returned.

Bunny webhooks are idempotent by `EventId`, ordered by provider `Timestamp`, signature-verified with constant-time comparison, and acknowledged quickly. Completed videos synchronize in the background; admins can retry through `/admin/videos/:id/sync`.

Jitsi is self-hosted, so the backend does not call a live-session provider API. It logs only the local operation, room identifier, and whether the caller is a moderator; room JWTs and `JITSI_APP_SECRET` never appear in logs.
