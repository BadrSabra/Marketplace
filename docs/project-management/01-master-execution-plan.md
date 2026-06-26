# 01 — Master Execution Plan
**المشروع:** مع جابر — Hyperlocal Marketplace Platform  
**التاريخ:** 26 يونيو 2026 | **الإصدار:** 1.0

---

## الرؤية
تحويل "مع جابر" من منصة MVP متكاملة إلى منتج تجاري عالمي قابل للبيع كـ SaaS + White Label + Multi-tenant، مع الحفاظ على إمكانية تشغيله كنظام مستقل.

---

## الأهداف الاستراتيجية

| # | الهدف | KPI | الموعد |
|---|-------|-----|--------|
| 1 | جاهزية كاملة للإنتاج | 85/100 Commercial Readiness | شهر 3 |
| 2 | أول 10 عملاء مدفوعين | MRR ≥ $5,000 | شهر 4 |
| 3 | إطلاق SaaS (multi-tenant) | ≥ 3 tenants نشطين | شهر 5 |
| 4 | تطبيق موبايل في الأسواق | iOS + Android مُنشور | شهر 6 |
| 5 | Commercial Launch رسمي | 20 عميل مدفوع | نهاية شهر 6 |

---

## المراحل الرئيسية

### المرحلة 1: Production Foundation (الأسابيع 1-4)
**الهدف:** إزالة الموانع التقنية من الإطلاق التجاري

| المهمة | الأولوية | الجهد |
|--------|---------|-------|
| Cloud Storage (AWS S3/Cloudinary) | 🔴 Critical | 3 أيام |
| Payment Gateway (Stripe) | 🔴 Critical | 5 أيام |
| JWT Refresh Token + Redis Blacklist | 🔴 Critical | 3 أيام |
| تقسيم routes.ts | 🔴 Critical | 3 أيام |
| Unit Tests (coverage ≥ 60%) | 🔴 Critical | 7 أيام |
| Swagger API Documentation | 🔴 Critical | 3 أيام |
| Email Verification عند التسجيل | 🟠 High | 2 يوم |
| README + Deployment Guide | 🟠 High | 2 يوم |

**نتيجة المرحلة:** Commercial Readiness ترتفع من 42/100 → 68/100

---

### المرحلة 2: Market Features (الأسابيع 5-8)
**الهدف:** إضافة ميزات تنافسية وتحسين UX

| المهمة | الأولوية | الجهد |
|--------|---------|-------|
| Google Maps / OpenStreetMap | 🟠 High | 4 أيام |
| PWA Support كامل | 🟠 High | 3 أيام |
| SMS Notifications (Twilio) | 🟠 High | 2 يوم |
| Coupons & Discount System | 🟠 High | 5 أيام |
| Loyalty Points System | 🟡 Medium | 5 أيام |
| PDF Invoice Download | 🟡 Medium | 2 يوم |
| Ratings UI (Full) | 🟡 Medium | 3 أيام |
| Redis Caching Layer | 🟠 High | 3 أيام |

**نتيجة المرحلة:** Commercial Readiness ترتفع → 78/100

---

### المرحلة 3: Multi-tenant SaaS (الأسابيع 9-14)
**الهدف:** بناء البنية التحتية للـ SaaS

| المهمة | الأولوية | الجهد |
|--------|---------|-------|
| DB Schema: إضافة tenant_id | 🔴 Critical | 3 أيام |
| Row-Level Security (PostgreSQL RLS) | 🔴 Critical | 5 أيام |
| Tenant Registration + Onboarding | 🟠 High | 5 أيام |
| Tenant Settings (Logo/Colors/Domain) | 🟠 High | 4 أيام |
| Subscription Billing (Stripe Billing) | 🟠 High | 5 أيام |
| Feature Flags per Tenant | 🟡 Medium | 3 أيام |
| Super Admin Console | 🟠 High | 4 أيام |
| Usage Tracking per Tenant | 🟡 Medium | 3 أيام |

**نتيجة المرحلة:** Commercial Readiness ترتفع → 85/100

---

### المرحلة 4: Mobile + Enterprise (الأسابيع 15-24)
**الهدف:** Mobile Apps + Enterprise features

| المهمة | الأولوية | الجهد |
|--------|---------|-------|
| React Native: Customer App | 🟠 High | 4 أسابيع |
| React Native: Driver App | 🟠 High | 3 أسابيع |
| GPS Live Tracking | 🟠 High | 2 أسابيع |
| Enterprise SSO (OAuth/SAML) | 🟡 Medium | 1 أسبوع |
| Advanced Analytics | 🟡 Medium | 2 أسبوع |
| CDN + Auto-scaling | 🟠 High | 1 أسبوع |

---

## الأولويات العليا (Top 10 Tasks Now)

```
P1. Cloud Storage           → يمنع deployment حقيقي
P2. Payment Gateway         → يمنع معاملات مالية
P3. JWT Refresh + Blacklist → ثغرة أمنية
P4. تقسيم routes.ts        → technical debt حرج
P5. Unit Tests (60%+)      → مخاطر production
P6. Swagger API Docs        → مطلوب للـ B2B
P7. Email Verification      → جودة البيانات
P8. Redis Setup             → أداء + sessions
P9. Google Maps             → تجربة توصيل
P10. PWA Support            → mobile users
```

---

## المخاطر الرئيسية

| # | الخطر | الاحتمال | الأثر | التخفيف |
|---|-------|---------|-------|---------|
| 1 | فقدان ملفات uploads/ عند النشر | عالٍ | عالٍ | Cloud Storage فوراً |
| 2 | JWT tokens لا تُلغى | متوسط | عالٍ | Blacklist + Refresh |
| 3 | Socket.IO ينكسر عند multi-instance | عالٍ | متوسط | Redis Adapter |
| 4 | DB migration خاطئة تحذف بيانات | منخفض | عالٍ جداً | Staging + Backup أولاً |
| 5 | Payment integration معقدة | متوسط | عالٍ | Stripe (الأبسط أولاً) |
| 6 | عدم عزل بيانات Tenants | منخفض حالياً | حرج | RLS + Tests صارمة |

---

## الاعتمادية بين المهام

```
Cloud Storage ────────────────► لا اعتمادية
Payment Gateway ──────────────► لا اعتمادية
Redis Setup ─────────────────► JWT Blacklist (يعتمد عليه)
JWT Blacklist ────────────────► يعتمد على Redis
Email Verification ───────────► لا اعتمادية
routes.ts تقسيم ─────────────► يجب قبل إضافة أي routes جديدة
tenant_id DB changes ─────────► يعتمد على Staging Environment
RLS ─────────────────────────► يعتمد على tenant_id migration
Subscription Billing ─────────► يعتمد على Tenant Registration
Mobile Apps ─────────────────► يعتمد على API Documentation + v2
```

---

## معايير النجاح

| المعيار | الهدف | طريقة القياس |
|---------|-------|-------------|
| Commercial Readiness | ≥ 85/100 | Monthly assessment |
| Test Coverage | ≥ 70% | Jest --coverage |
| API Response Time (P95) | < 200ms | Prometheus |
| Uptime | ≥ 99.5% | Uptime Robot |
| Bug Rate | < 1 critical/week | Issue tracker |
| MRR | $5,000+ بنهاية شهر 4 | Stripe Dashboard |
| NPS | ≥ 50 | Customer surveys |
| Tenant Isolation | 100% (zero cross-tenant leaks) | Security tests |
