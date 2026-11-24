# Kafaat API Contract

## Conventions

- Base URL: `/api/v1`
- Authentication: `Authorization: Bearer <opaqueSessionToken>`
- IDs are decimal strings because PostgreSQL uses `bigint`.
- Dates use ISO 8601 UTC strings.
- Phone numbers use E.164, for example `+966501234567`.
- Unknown request properties are rejected.

Successful response:

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "uuid", "timestamp": "2026-11-16T12:00:00.000Z" }
}
```

Error response:

```json
{
  "success": false,
  "error": { "code": "VALIDATION_FAILED", "message": "Request validation failed", "details": [] },
  "meta": { "requestId": "uuid", "timestamp": "2026-11-16T12:00:00.000Z" }
}
```

## Authentication and account

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Register with `name`, `email`, `phone`, `password` |
| POST | `/auth/login` | Public | Login with `email`, `password` |
| POST | `/auth/mfa/verify` | Admin pre-auth | Complete TOTP setup or verification |
| POST | `/auth/logout` | User | Revoke the current session |
| POST | `/auth/logout-all` | User | Revoke all sessions for the account |
| GET | `/users/me` | User | Current profile |
| PATCH | `/users/me` | User | Update `name`, `email`, `phone`, or `avatarUrl` |
| GET | `/users` | Admin | Latest 100 users |

Student login and registration return `{ accessToken, tokenType, expiresIn, user }`. The token is a random 256-bit opaque value; only its peppered SHA-256 hash is stored. Administrator login first returns an expiring MFA challenge, and the session is created only after `/auth/mfa/verify` succeeds. The Next.js BFF stores sessions in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie and never in browser storage. Unsafe BFF calls require both a trusted `Origin` and a timing-safe double-submit CSRF token.

## Catalog

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/categories` | Public | List categories |
| GET | `/instructors` | Public | List instructors |
| GET | `/courses?categoryId=` | Public | List published courses |
| GET | `/courses/:slug` | Public | Published course, instructor, category, ordered lessons |
| GET | `/admin/courses` | Admin | All courses, including drafts and lessons |
| POST/PATCH/DELETE | `/admin/categories[...]` | Admin | Category management |
| POST/PATCH/DELETE | `/admin/instructors[...]` | Admin | Instructor management |
| POST/PATCH/DELETE | `/admin/courses[...]` | Admin | Course management |
| POST/PATCH/DELETE | `/admin/courses/:courseId/videos`, `/admin/videos/:id` | Admin | Lesson metadata management |

## Bunny Stream video flow

`POST /admin/courses/:courseId/videos/upload-session` requires admin access. It accepts title, description, free/paid access, position, optional expiry, and thumbnail time. The response contains the local lesson and `upload` with the Bunny TUS endpoint, `videoId`, `libraryId`, expiry, SHA-256 signature, and metadata. The frontend uploads directly to Bunny using `tus-js-client`; the API key never reaches the browser.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/admin/videos/:id/sync` | Admin | Refresh duration, thumbnail, and processing status |
| GET | `/videos/:videoId/playback` | Public for free lesson; subscriber otherwise | Short-lived signed Bunny Player URL |
| POST | `/webhooks/bunny/stream` | Bunny HMAC only | Idempotent processing-status callback |

The webhook verifies the exact raw body with the library read-only key, rejects invalid version/algorithm/signature, stores `EventId` for deduplication, and ignores older events using `Timestamp`.

## Subscription and progress

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/plans` | Public | List active subscription plans with features |
| GET | `/admin/plans` | Admin | List active and inactive plans |
| POST/PATCH/DELETE | `/admin/plans[...]` | Admin | Create, update, or delete a plan |
| POST | `/admin/plans/:id/features` | Admin | Add an entitlement feature to a plan |
| DELETE | `/admin/plans/:planId/features/:featureId` | Admin | Remove a feature from a plan |
| GET | `/subscriptions/me` | User | Current subscription |
| POST | `/subscriptions/admin` | Super admin | Assign a plan; expiry is calculated from the plan duration |
| PUT | `/progress/videos/:videoId` | Free lesson or subscriber | Save watched seconds; complete at 90% |
| GET | `/progress/courses/:courseId` | User | Course completion percentage |

## Operations

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health/live` | Process liveness |
| GET | `/health/ready` | PostgreSQL readiness |
| GET | `/metrics` | Prometheus metrics; requires `Bearer <METRICS_TOKEN>` |
| GET | `/docs` | Swagger UI; development only by default |
| GET | `/docs/openapi.json` | OpenAPI document; development only by default |
| GET | `/admin/security/audit-log` | Latest audit events; super admin only, cursor-paginated |

## Error codes

`VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `CONFLICT`, `SUBSCRIPTION_REQUIRED`, `RATE_LIMIT_EXCEEDED`, `DATABASE_UNAVAILABLE`, `VIDEO_PROVIDER_NOT_CONFIGURED`, `VIDEO_PROVIDER_UNAVAILABLE`, `INVALID_WEBHOOK_SIGNATURE`, `LIVE_PROVIDER_NOT_CONFIGURED`, `LIVE_PROVIDER_UNAVAILABLE`, `LIVE_SESSION_NOT_AVAILABLE`, `INTERNAL_ERROR`.

Paid-course playback requires an active subscription whose plan contains the `all_content` feature. Joining a live session requires an active subscription whose plan contains the `online_sessions` feature.

## Jitsi self-hosted live sessions

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/live-sessions` | Public | List upcoming and currently available sessions without room secrets |
| GET | `/live-sessions/:id/join` | Premium user / Admin | Return a short-lived Jitsi JWT and room configuration |
| GET | `/admin/live-sessions` | Admin | List sessions for dashboard management |
| POST | `/admin/live-sessions` | Admin | Create a local session and an unguessable Jitsi room name |
| PATCH | `/admin/live-sessions/:id` | Admin | Update local session scheduling metadata |
| DELETE | `/admin/live-sessions/:id` | Admin | Remove the local session and revoke future joins |

The attendee join endpoint opens 15 minutes before `startsAt` and closes 30 minutes after the scheduled duration. Premium students receive a room-scoped two-hour JWT only after entitlement verification. Admins and super admins receive a moderator JWT from the same endpoint; that role is derived server-side and never from a client parameter. Session states are synchronized every minute from the scheduled time (`scheduled`, `live`, `ended`).

## Manual bank transfer

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/bank-transfer` | Public | Current bank, IBAN, optional account/SWIFT, support WhatsApp, and instructions |
| GET | `/admin/bank-transfer` | Admin | Full settings, including inactive bank details |
| PUT | `/admin/bank-transfer` | Admin | Replace bank-transfer details and enable or disable public display |

The customer chooses a plan, transfers the monthly amount, and sends the receipt image to the configured WhatsApp number. A super admin verifies the transfer and assigns the plan through `POST /subscriptions/admin`. No card data or receipt image is stored by the platform in this flow.
