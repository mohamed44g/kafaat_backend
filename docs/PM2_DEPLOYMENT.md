# تشغيل كفاءات عبر PM2

تعمل قاعدة البيانات PostgreSQL داخل Docker فقط، بينما الواجهة والخلفية تعملان عبر PM2.

## أول تشغيل أو تحديث

نفّذ الأوامر بحساب `kafaat` (أو أضف `sudo -u kafaat` قبل أوامر PM2 وnpm عند الدخول بحساب `root`).

```bash
cd /opt/kafaat/backend && git pull && npm ci && npm run build
cd /opt/kafaat/frontend && git pull && npm ci && npm run build

# صور الكورسات تُحفظ هنا ويجب تضمين المجلد في النسخ الاحتياطي
mkdir -p /opt/kafaat/backend/uploads/courses
chmod 750 /opt/kafaat/backend/uploads /opt/kafaat/backend/uploads/courses

# Next standalone لا ينسخ public و static تلقائياً
cd /opt/kafaat/frontend
rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static

cd /opt/kafaat/backend
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
```

تم تفعيل خدمة `pm2-kafaat` في systemd؛ لذلك ستعود التطبيقات تلقائياً بعد إعادة تشغيل الـVPS.

## إعداد Nginx لصور الكورسات

أضف داخل كتلة HTTPS الخاصة بـ `kafaat-academy.com` ثم نفّذ `nginx -t` قبل إعادة التحميل:

```nginx
client_max_body_size 6m;

location ^~ /api/v1/uploads/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

المسار `/opt/kafaat/backend/uploads` بيانات تشغيل دائمة وليس جزءاً من Git؛ أضفه إلى النسخ الاحتياطي مع قاعدة البيانات.

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
