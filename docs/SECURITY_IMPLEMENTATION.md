# Kafaat security baseline

This document records the controls implemented for Kafaat and the parts of the
reference audit that do not apply to the current product.

## Implemented controls

- Opaque 256-bit server-side sessions. Only SHA-256 HMAC-style hashes (peppered)
  are stored in PostgreSQL. Sessions have absolute and idle expiry, revocation,
  and a five-device cap.
- `HttpOnly`, `Secure`, `SameSite=Strict` session cookies in the Next.js BFF.
  State-changing BFF calls require a same-origin request and a timing-safe
  double-submit CSRF token.
- Argon2id password hashing. New passwords require 12-128 characters with
  uppercase, lowercase, numeric, and special characters.
- Generic login failures, constant-work verification for unknown accounts,
  endpoint throttling, and a 15-minute lock after five failed attempts.
- Deny-by-default RBAC on admin routes plus ownership-scoped queries for profile,
  progress, subscription, playback, and live-session access.
- Parameterized PostgreSQL queries, global DTO validation with unknown fields
  rejected, request body limits, query timeouts, and bounded list sizes.
- Helmet on the API; nonce-based CSP, HSTS, clickjacking, MIME-sniffing,
  referrer, permissions, COOP, and CORP headers on the frontend.
- Production CORS allowlist, disabled production Swagger by default, hidden
  framework signature, and a token-protected metrics endpoint.
- Structured redacted logs, correlation IDs, safe global errors, Prometheus
  metrics, and a persistent security audit trail for auth and admin activity.
- Bunny Stream timeouts, signed short-lived playback links, webhook signature
  validation, and server-side Jitsi entitlement checks with short-lived tokens.
- Lockfiles, weekly dependency audit, lint/build gates, and CycloneDX SBOM
  artifacts in GitHub Actions.
- PostgreSQL bound to localhost, encrypted daily backups, retention, a restore
  drill, and a one-minute readiness monitor with an optional alert webhook.

## Current applicability

- Payment gateway/webhook controls are not applicable while subscriptions are
  manually approved after bank transfer. Activation remains a super-admin-only
  operation and is audited.
- Email verification, password reset OTP, and public file uploads do not exist
  yet. Course cover uploads are admin-only, size/rate limited, signature checked,
  re-encoded to WebP without metadata, and stored under random UUID filenames.
- Jitsi is self-hosted; Zoom OAuth and Meeting SDK controls are no longer part of
  the active architecture.

## Operational requirements

- Store runtime secrets only in root-owned production environment files.
- Rotate the session pepper only with a planned forced logout of all users.
- Rotate Bunny/Jitsi/database secrets after any suspected exposure.
- Enable GitHub secret scanning and push protection in both repository settings.
- Review `security_audit_log`, dependency audit results, failed-login spikes,
  readiness alerts, backup timer state, and restore-drill logs every month.
