# تشغيل كفاءات عبر PM2

تعمل قاعدة البيانات PostgreSQL داخل Docker فقط، بينما الواجهة والخلفية تعملان عبر PM2.

## أول تشغيل أو تحديث

```bash
cd /opt/kafaat/backend && npm ci && npm run build
cd /opt/kafaat/frontend && npm ci && npm run build

cd /opt/kafaat/backend
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
```

## إدارة الخدمات

```bash
pm2 status
pm2 logs kafaat-backend
pm2 logs kafaat-frontend
pm2 restart kafaat-backend
pm2 restart kafaat-frontend
pm2 stop kafaat-backend kafaat-frontend
pm2 start kafaat-backend kafaat-frontend
```

## قاعدة البيانات

```bash
cd /opt/kafaat/backend
docker compose --env-file .env.production -f docker-compose.production.yml up -d postgres
docker compose --env-file .env.production -f docker-compose.production.yml stop postgres
```
