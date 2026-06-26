# 09 — Versioning Strategy
**Semantic Versioning للمشروع**

---

## الصيغة: MAJOR.MINOR.PATCH

```
v1.2.3
  │ │ └─ PATCH: bug fixes, security patches (backward compatible)
  │ └─── MINOR: new features (backward compatible)
  └───── MAJOR: breaking changes في الـ API أو DB schema
```

---

## متى نرفع كل رقم؟

### PATCH (v1.0.X) — بدون تغيير في الـ API
```
✅ إصلاح bug لا يؤثر على الـ API
✅ تحسين أداء
✅ تحديث dependencies طفيفة
✅ إصلاح أمني لا يغير الواجهة
✅ تحسين رسائل الخطأ
مثال: v1.0.0 → v1.0.1 (إصلاح race condition في OTP)
```

### MINOR (v1.X.0) — ميزة جديدة، لا كسر للمتكاملين
```
✅ إضافة endpoint جديد
✅ إضافة حقل اختياري لـ response
✅ ميزة جديدة للمستخدم (Coupons، Maps...)
✅ تحسين لا يكسر الـ API الحالي
مثال: v1.0.0 → v1.1.0 (إضافة Stripe Payment Gateway)
```

### MAJOR (vX.0.0) — تغيير جذري
```
✅ تغيير بنية response لـ API موجود
✅ إضافة tenant_id لـ DB (multi-tenant migration)
✅ تغيير نظام Authentication
✅ إزالة endpoint مستخدم
✅ تغيير اسم field في response
مثال: v1.0.0 → v2.0.0 (Multi-tenant SaaS restructure)
```

---

## الإصدارات المخطط لها

| الإصدار | الوصف | الجدول الزمني |
|---------|-------|-------------|
| **v0.9.0** | الوضع الحالي (MVP) | الآن |
| **v1.0.0** | Production Foundation (Storage+Payment+Tests) | شهر 1 |
| **v1.1.0** | Maps + PWA + SMS | شهر 2 |
| **v1.2.0** | Coupons + Loyalty + Ratings | شهر 3 |
| **v1.3.0** | Redis Caching + Performance | شهر 3 |
| **v2.0.0** | Multi-tenant SaaS (MAJOR: DB changes) | شهر 4 |
| **v2.1.0** | Subscription Billing + Tenant Portal | شهر 4-5 |
| **v3.0.0** | Mobile Apps + GPS (MAJOR) | شهر 5-6 |

---

## Git Tags

```bash
# كل release تحصل على annotated tag
git tag -a v1.0.0 -m "Release v1.0.0: Production Foundation

Changes:
- Cloud Storage (AWS S3)
- Stripe Payment Gateway
- JWT Refresh Token
- routes.ts split into modules
- Unit test coverage 65%
- Swagger API Documentation

Breaking Changes: None
Migration Required: Set AWS_* and STRIPE_* env vars"

git push origin v1.0.0
```

---

## API Versioning

```
الحالي:  /api/products           (v1 implicit)
المستقبل: /api/v1/products       (explicit)
           /api/v2/products       (عند breaking change)
```

### متى تُضاف v2؟
```
عند إجراء breaking change في response format
يبقى /api/v1/... يعمل لمدة 3 أشهر minimum
توثيق deprecation قبل إزالة أي version
```
