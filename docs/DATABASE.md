# Database

PostgreSQL is accessed with parameterized SQL through the `pg` driver. There is no ORM and no schema synchronization at runtime.

## Current tables

- `users`: student/admin accounts and cached subscription state.
- `categories`, `instructors`, `courses`, `videos`: catalog hierarchy.
- `subscriptions`: subscription history and active period.
- `subscription_plans`: price, currency, duration, availability, and plan copy.
- `subscription_plan_features`: flexible entitlement keys and user-facing labels per plan.
- `user_video_progress`: one progress row per user and lesson.
- `bunny_webhook_events`: Bunny webhook idempotency and audit trail.
- `bank_transfer_settings`: singleton bank account, support WhatsApp, instructions, and public visibility flag managed from the dashboard.
- `live_sessions`: scheduled Jitsi room name, lifecycle state, optional recording flag, and creating admin.

Numbered SQL migrations are stored in `src/database/migrations`. The seeded Basic and Premium plans renew monthly at 7 KWD and 10 KWD respectively.

## Apply

```bash
copy .env.example .env
npm run db:create
npm run db:migrate
npm run db:show
```

For an existing database, never edit an already-applied SQL migration; add a new numbered SQL migration and extend the runner. Back up production before `db:revert`.

`005_zoom_live_sessions` established the initial sessions table and `006_jitsi_live_sessions` adds Jitsi room identity. Legacy provider columns are retained but unused so historical records are not destructively removed. Every Jitsi room name is unique and unguessable; dates use `timestamptz`, and session duration is constrained to 15–1440 minutes.
