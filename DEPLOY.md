# النشر التلقائي - منصة مع جابر

## طريقتان فقط بعد رفع الكود

---

## الطريقة 1: أمر واحد على أي خادم

```bash
sudo bash <(curl -sSL https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/install.sh)
```

هذا الأمر يقوم تلقائياً بـ:
- ✅ تثبيت Node.js و PostgreSQL و NGINX
- ✅ نسخ المشروع وبنائه
- ✅ إعداد قاعدة البيانات
- ✅ تشغيل التطبيق مع PM2
- ✅ إعداد جدار الحماية
- ✅ طباعة كود الـ Webhook جاهزاً للنسخ

**بعدها:** أضف الـ Webhook في GitHub (خطوة واحدة) وكل `git push` = تحديث تلقائي!

---

## الطريقة 2: Docker (لمن يفضّل الحاويات)

```bash
# 1. انسخ ملف البيئة
cp .env.example .env
# عدّل .env بكلمة سر قاعدة البيانات

# 2. شغّل كل شيء بأمر واحد
DB_PASS=كلمة_السر docker-compose up -d
```

GitHub Actions يبني صورة Docker تلقائياً عند كل push ويرفعها مجاناً على GitHub Container Registry.

---

## مراقبة النشر

```
GET /api/deploy/status   ← آخر 10 عمليات نشر
GET /api/health          ← حالة التطبيق
```
