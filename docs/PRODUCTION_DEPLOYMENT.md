# Kafaat production deployment

The VPS is prepared at `/opt/kafaat` with Docker, Nginx, Certbot, Fail2ban, UFW, and the official Jitsi Docker repository. The web application and database stay internal to Docker; only Nginx exposes web traffic.

## First application deployment

Clone this repository to `/opt/kafaat/backend` and the frontend repository to `/opt/kafaat/frontend`. Then create `/opt/kafaat/backend/.env.production` from `.env.production.example`.

```bash
cd /opt/kafaat/backend
cp .env.production.example .env.production
chmod 600 .env.production
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
```

The backend runs its numbered PostgreSQL migrations before starting. PostgreSQL is never published to the internet; the frontend and backend are bound to `127.0.0.1` for Nginx to proxy after the domain is configured.

## Domain step

After DNS points `example.com`, `api.example.com` if desired, and `meet.example.com` to the VPS, configure Nginx virtual hosts and obtain TLS certificates with Certbot. Then finish the Jitsi configuration in `JITSI_SETUP.md` with the same Jitsi app ID and secret in both locations.

## Operations

```bash
cd /opt/kafaat/backend
docker compose -f docker-compose.production.yml logs -f --tail=100
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml up -d --build
```

Use Docker volume backups for `kafaat_postgres_data`; never expose port 5432 publicly. Before disabling root/password SSH access, add and verify an SSH key for a separate sudo user.
