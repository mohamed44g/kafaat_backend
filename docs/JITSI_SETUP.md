# Jitsi Meet self-hosted setup

The platform embeds a private Jitsi server through the IFrame API. The browser never receives `JITSI_APP_SECRET`; the backend creates a short-lived, room-scoped JWT only after it verifies the account role and the Premium `online_sessions` entitlement.

## Before deployment

1. Create a dedicated subdomain such as `meet.example.com` and point its `A` record to the Contabo VPS public IP.
2. Use a valid TLS certificate. Browsers require HTTPS for camera and microphone access.
3. Open `80/tcp`, `443/tcp`, and `10000/udp` in both the Contabo firewall and UFW. Keep `22/tcp` limited to your administration IP when possible.
4. Do not run a second container or web server that binds the same `80` or `443` ports. If the application will use the same VPS, route the main site and `meet.example.com` as separate Nginx/Caddy virtual hosts before production.

## Docker deployment

On a clean Ubuntu 24.04 VPS, use the official Docker release rather than copying a compose file from this project:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin curl unzip
sudo mkdir -p /opt/jitsi
sudo chown "$USER":"$USER" /opt/jitsi
cd /opt/jitsi
curl -fsSL https://api.github.com/repos/jitsi/docker-jitsi-meet/releases/latest \
  | grep browser_download_url \
  | grep zip \
  | cut -d '"' -f 4 \
  | xargs curl -fL -o jitsi.zip
unzip jitsi.zip
cd docker-jitsi-meet-*
cp env.example .env
./gen-passwords.sh
```

Edit the generated `.env`. Keep the generated XMPP/Jicofo/JVB passwords unchanged, and add or replace these values:

```ini
CONFIG=~/.jitsi-meet-cfg
PUBLIC_URL=https://meet.example.com
TZ=Asia/Kuwait

ENABLE_LETSENCRYPT=1
LETSENCRYPT_DOMAIN=meet.example.com
LETSENCRYPT_EMAIL=ops@example.com
ENABLE_HTTP_REDIRECT=1

ENABLE_AUTH=1
ENABLE_GUESTS=0
AUTH_TYPE=jwt
JWT_APP_ID=kafaat
JWT_APP_SECRET=use-a-long-random-value-here
JWT_ACCEPTED_ISSUERS=kafaat
JWT_ACCEPTED_AUDIENCES=kafaat
JWT_ALLOW_EMPTY=0
XMPP_MUC_MODULES=token_affiliation
ENABLE_AUTO_OWNER=0

JVB_ADVERTISE_IPS=YOUR_CONTABO_PUBLIC_IP
JVB_PORT=10000
```

Generate the shared secret without putting it in shell history:

```bash
openssl rand -hex 48
```

Start the stack and inspect it:

```bash
docker compose up -d
docker compose ps
docker compose logs -f --tail=100
```

## Application configuration

Use the same `JWT_APP_ID` and `JWT_APP_SECRET` in `/opt/kafaat/backend/.env.production`:

```ini
JITSI_MEET_URL=https://meet.example.com
JITSI_DOMAIN=meet.example.com
JITSI_APP_ID=kafaat
JITSI_APP_SECRET=the-same-long-random-value
JITSI_JOIN_TOKEN_TTL_SECONDS=7200
```

Then apply the database migration and restart the backend:

```bash
npm run db:migrate
```

No Jitsi secret belongs in the Next.js environment or in `NEXT_PUBLIC_*` variables.

## What the roles mean

- A student can receive a Jitsi token only during the configured session window and only when their active plan has the `online_sessions` feature.
- `admin` and `super_admin` users receive a server-signed moderator token. The frontend cannot upgrade itself to a moderator.
- Each dashboard-created session receives a random database-backed room name; a title is never used as the room identifier.

Recording is intentionally not enabled here. Jibri recording/streaming adds separate server capacity and storage requirements and should be configured as a distinct follow-up, not by turning on an unverified toggle.
