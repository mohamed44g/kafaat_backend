# Kafaat API

NestJS REST API for Kafaat Academy. It covers server-side sessions, administrator MFA, users, the course catalog, subscriptions, video progress, Bunny Stream, self-hosted Jitsi sessions, PostgreSQL migrations, audit logs, health checks, and metrics.

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `SESSION_HASH_PEPPER`, `MFA_ENCRYPTION_KEY`, and `METRICS_TOKEN` to separate random secrets.
2. Run `npm run db:create` to create the database named in `DATABASE_URL`, or run `docker compose up -d postgres` if Docker is available.
3. Run `npm run db:migrate`.
4. Run `npm run db:seed` to add the initial published catalog.
5. Run `npm run start:dev`.

The API is available at `http://localhost:3001/api/v1`. Swagger is enabled in development and disabled in production unless explicitly enabled.

## Bunny Stream

Rotate the API key that appeared in the shared screenshot before using this integration. Put the replacement values only in `.env`:

```env
BUNNY_STREAM_LIBRARY_ID=
BUNNY_STREAM_API_KEY=
BUNNY_STREAM_READ_ONLY_API_KEY=
BUNNY_STREAM_TOKEN_AUTH_KEY=
```

Configure the library webhook as:

```text
https://YOUR_API_HOST/api/v1/webhooks/bunny/stream
```

Enable **Embed view token authentication** in Bunny Stream. The backend creates presigned TUS upload sessions for admins and short-lived signed player URLs after checking free-video or subscription access.

To create the first dashboard super-admin, set `SEED_ADMIN_EMAIL` and a strong `SEED_ADMIN_PASSWORD` before running `npm run db:seed`. No default administrator or password is created.

## Commands

```bash
npm run start:dev
npm run build
npm run lint
npm run db:create
npm run db:migrate
npm run db:show
npm run db:seed
npm run db:revert
```

See [API_CONTRACT.md](docs/API_CONTRACT.md), [DATABASE.md](docs/DATABASE.md), [OBSERVABILITY.md](docs/OBSERVABILITY.md), and [SECURITY_IMPLEMENTATION.md](docs/SECURITY_IMPLEMENTATION.md).
