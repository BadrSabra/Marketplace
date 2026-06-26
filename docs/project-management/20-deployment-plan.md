# 20 — Deployment Plan
**خطة النشر الكاملة: Development → Staging → Production**

---

## 1. البيئات

### Development (محلي)
```
الغرض:     تطوير واختبار محلي
DB:        PostgreSQL محلي أو Docker
Storage:   uploads/ محلي
URL:       http://localhost:5000
Features:  جميع الـ features مفعلة
Seed Data: بيانات تجريبية (seed.ts)
Hot reload: ✅
```

### Staging
```
الغرض:     اختبار قبل الإنتاج
DB:        PostgreSQL منفصلة (staging DB)
Storage:   S3 bucket منفصل (staging-bucket)
URL:       https://staging.mitgaber.com
Features:  مطابق للإنتاج
Data:      نسخة مخففة من بيانات الإنتاج (مجهولة الهوية)
Deploy:    تلقائي عند merge إلى develop
```

### Production
```
الغرض:     بيئة العملاء الحقيقيين
DB:        PostgreSQL مُدارة (Supabase/RDS/Neon)
Storage:   S3 bucket إنتاج
URL:       https://mitgaber.com
Deploy:    يدوي + موافقة بعد نجاح Staging
Backup:    يومي تلقائي
```

---

## 2. Environment Variables

```bash
# Server
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=<64-char random string>
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=<64-char different string>

# Redis
REDIS_URL=redis://...

# Storage
STORAGE_PROVIDER=s3  # أو cloudinary
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_BUCKET_NAME=mitgaber-prod
AWS_REGION=me-south-1  # Bahrain للسوق العربي

# أو Cloudinary
CLOUDINARY_URL=cloudinary://...

# Payment
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=admin@mitgaber.com

# SMS (Twilio)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1234567890

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=...
FROM_EMAIL=noreply@mitgaber.com

# Maps
MAPS_API_KEY=...

# Monitoring
SENTRY_DSN=...
```

---

## 3. خطوات النشر للإنتاج

### قبل كل deployment

```bash
# 1. تأكيد tests تمر
npm test

# 2. تأكيد TypeScript بدون errors
npm run check

# 3. Build التطبيق
npm run build

# 4. اختبار الـ build محلياً
NODE_ENV=production node dist/index.js
```

### Database Migration

```bash
# 1. أنشئ backup أولاً
pg_dump $DATABASE_URL > backups/$(date +%Y%m%d_%H%M%S).sql

# 2. اختبر Migration على Staging
DATABASE_URL=$STAGING_DB npm run db:migrate

# 3. تأكيد Staging يعمل صحيحاً

# 4. طبق على Production
DATABASE_URL=$PROD_DB npm run db:migrate

# 5. Verify
npm run db:verify
```

### Deployment Steps

```bash
# على Replit
1. git push origin main
2. Replit يبدأ الـ workflow تلقائياً

# على VPS/Cloud
1. git pull origin main
2. npm ci --production
3. npm run build
4. pm2 reload mitgaber --update-env

# Docker
1. docker build -t mitgaber:v1.x.x .
2. docker push registry/mitgaber:v1.x.x
3. docker pull registry/mitgaber:v1.x.x (على الخادم)
4. docker-compose up -d --no-deps app
```

---

## 4. Rollback Plan

### السيناريو 1: Bug بسيط (Rollback الكود)
```bash
# إعادة الـ deployment السابق
git revert HEAD
git push origin main
# أو
git checkout v1.x.x
npm run build
pm2 reload mitgaber
```

### السيناريو 2: DB Migration خاطئة (Rollback قاعدة البيانات)
```bash
# 1. إيقاف التطبيق
pm2 stop mitgaber

# 2. استعادة backup
psql $DATABASE_URL < backups/20260626_120000.sql

# 3. Rollback الكود
git checkout v1.x.x-1

# 4. إعادة التشغيل
npm run build
pm2 start mitgaber
```

### السيناريو 3: Replit Environment
```
Replit → Checkpoints → اختيار checkpoint قبل المشكلة → Restore
```

---

## 5. Health Checks

```bash
# فحص عام
curl https://mitgaber.com/api/health

# فحص DB + تفاصيل
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://mitgaber.com/api/admin/health

# Response المتوقع
{
  "status": "ok",
  "db": { "status": "connected", "latency": 12 },
  "memory": { "used": 145, "free": 380 },
  "uptime": 86400
}
```

---

## 6. Backup Strategy

### Database Backup
```bash
# يومي (Cron: كل يوم 2 صباحاً)
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/db_$(date +%Y%m%d).sql.gz
# رفع إلى S3
aws s3 cp /backups/db_$(date +%Y%m%d).sql.gz s3://mitgaber-backups/db/

# احتفاظ بـ:
# - يومياً: 7 أيام
# - أسبوعياً: 4 أسابيع
# - شهرياً: 12 شهر
```

### File Backup
```
Storage في S3 → S3 Versioning + Replication تلقائي
لا حاجة لـ manual backup للملفات
```

---

## 7. Scaling Strategy

### الطبقة الأولى (الحالي): Single Server
```
Replit أو VPS واحد
يدعم حتى ~200 concurrent users
```

### الطبقة الثانية (شهر 3): Optimized Single
```
Redis Caching + CDN + DB Connection Pool
يدعم حتى ~1,000 concurrent users
```

### الطبقة الثالثة (شهر 5): Horizontal Scale
```
Load Balancer (Nginx/Cloudflare)
2-4 App Instances
Redis Cluster
PostgreSQL Read Replica
يدعم حتى ~10,000 concurrent users
```

### الطبقة الرابعة (المستقبل): Cloud-Native
```
Kubernetes / ECS
Auto-scaling
Database Sharding
CDN (Cloudflare)
يدعم 100,000+ concurrent users
```
