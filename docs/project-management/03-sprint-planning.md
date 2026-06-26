# 03 — Sprint Planning
**Sprint مدته أسبوعان | Capacity: ~80 ساعة/Sprint (2 مطوّران)**

---

## Sprint 1 (الأسبوع 1-2)
**الهدف:** Cloud Storage + JWT Security + بداية Unit Tests

### Sprint Goal
> "جعل النظام آمناً ضد فقدان الملفات وجعل الـ JWT قابلاً للإلغاء"

### Stories المُختارة

| ID | Story | Hours | الملاحظة |
|----|-------|-------|---------|
| S01-01-01 | Cloud Storage (AWS S3) | 18h | أعلى أولوية |
| S01-03-01 | JWT Blacklist + Refresh Token | 16h | أمان حرج |
| T34 | إعداد Jest + ts-jest | 3h | يُمكّن Tests |
| T35 | Unit Tests: wallet.service.ts | 6h | مالياً حرج |
| T36 | Unit Tests: order.service.ts | 5h | |

**Total: 48h** (من capacity 80h — لأن T21-T27 يبدأ Sprint 2)

### Tasks

**Week 1:**
```
اليوم 1-2: Cloud Storage
  T01: تنصيب packages (1h)
  T02: storage-provider.ts (4h)
  T03: upload middleware → S3 (3h)

اليوم 3: Storage + Products/Stores
  T04: products.service.ts upload/delete (3h)
  T05: stores.service.ts upload/delete (3h)

اليوم 4: JWT Security
  T15: Redis client (2h)
  T16: JWT Blacklist middleware (4h)

اليوم 5: JWT + Tests setup
  T17: POST /api/auth/logout (2h)
  T18: POST /api/auth/refresh-token (4h)
```

**Week 2:**
```
اليوم 6-7: Tests Infrastructure + Wallet Tests
  T34: Jest setup (3h)
  T35: wallet.service.ts tests (6h)

اليوم 8: Tests + Storage Tests
  T06: unit tests لـ storage-provider.ts (3h)
  T20: tests لـ JWT blacklist + refresh (3h)

اليوم 9-10: Order Tests + Frontend JWT
  T36: order.service.ts tests (5h)
  T19: frontend refresh token (3h)
  T07: توثيق env vars (1h)
```

### Deliverables
- ✅ صور المنتجات والمتاجر تُرفع لـ S3
- ✅ logout يُلغي الـ token فوراً
- ✅ access token يُجدَّد تلقائياً
- ✅ Jest يعمل، wallet tests تمر

### Testing (Sprint Review)
```
npm test                    → يمر بالكامل
رفع صورة منتج              → تظهر من S3 URL
logout + استخدام القديم     → 401 Unauthorized
token منتهي → auto refresh  → ينجح
```

### Retrospective Template
```
✅ ما الذي سار جيداً؟
🔧 ما الذي يمكن تحسينه؟
🚧 ما العوائق التي واجهناها؟
📋 Actions للـ Sprint القادم:
```

---

## Sprint 2 (الأسبوع 3-4)
**الهدف:** تقسيم routes.ts + Swagger + اكتمال الـ Tests الأساسية

### Sprint Goal
> "كل route في ملفه، وكل endpoint موثق في Swagger"

### Stories المُختارة

| ID | Story | Hours | الملاحظة |
|----|-------|-------|---------|
| S01-04-01 | تقسيم routes.ts | 12h | Technical Debt حرج |
| F01-05 | Swagger API Documentation | 17h | مطلوب للـ B2B |
| T37 | Unit Tests: suborder.service.ts | 4h | |
| T38 | Unit Tests: deliveryOffer.service.ts | 4h | |
| T39 | Unit Tests: deliveryOtp.service.ts | 3h | |

**Total: 40h** (مع وقت للـ Bug fixes)

### Tasks

**Week 1:**
```
اليوم 1-3: تقسيم routes.ts
  T21: auth.router.ts (2h)
  T22: wallet.router.ts (2h)
  T23: orders.router.ts (2h)
  T24: admin.router.ts (2h)
  T25: delivery.router.ts (2h)
  T26: تحديث routes.ts الرئيسي (2h)
  T27: تحقق Tests تمر (2h)

اليوم 4-5: Swagger Setup + Auth Docs
  T28: swagger-ui-express setup (2h)
  T29: توثيق Auth endpoints (3h)
  T30: توثيق Wallet endpoints (3h)
```

**Week 2:**
```
اليوم 6-7: Swagger continued
  T31: توثيق Orders endpoints (4h)
  T32: توثيق Delivery endpoints (3h)
  T33: توثيق Admin endpoints (4h)

اليوم 8-10: Unit Tests + Buffer
  T37: suborder tests (4h)
  T38: deliveryOffer tests (4h)
  T39: deliveryOtp tests (3h)
  Buffer للـ bug fixes (5h)
```

### Deliverables
- ✅ routes.ts < 50 سطر، كل module في ملفه
- ✅ /api-docs يعمل بجميع الـ endpoints موثقة
- ✅ Coverage ≥ 65% على Service layer

---

## Sprint 3 (الأسبوع 5-6)
**الهدف:** Payment Gateway + Email Verification + Integration Tests

### Sprint Goal
> "المنصة تقبل مدفوعات حقيقية وتتحقق من البريد الإلكتروني"

### Stories المُختارة

| ID | Story | Hours | الملاحظة |
|----|-------|-------|---------|
| S01-02-01 | Stripe Payment Gateway | 20h | أعلى قيمة تجارية |
| Email Verification | تأكيد البريد عند التسجيل | 8h | |
| Integration Tests: Auth + Wallet | | 6h | |
| Integration Tests: Order flow | | 6h | |

**Total: 40h**

### Deliverables
- ✅ بطاقة ائتمانية تُقبل فعلياً عبر Stripe
- ✅ Webhook يُفعّل الإيداع تلقائياً
- ✅ email verification عند التسجيل
- ✅ Integration tests تغطي Order flow كاملاً

---

## Sprint 4 (الأسبوع 7-8)
**الهدف:** Google Maps + PWA + Redis Caching

### Sprint Goal
> "المستخدم يرى موقع المتجر على الخريطة، والموقع يعمل كتطبيق موبايل"

### Stories المُختارة

| ID | Story | Hours |
|----|-------|-------|
| F02-01 | Google Maps Integration | 9h |
| F02-02 | PWA Support | 8h |
| Redis Caching Layer | stores + products | 6h |
| Socket.IO Redis Adapter | | 4h |
| Performance: Indexes SQL | | 3h |

**Total: 30h** + buffer لـ testing

### Deliverables
- ✅ خريطة تعرض موقع المتجر
- ✅ "Add to Home Screen" يعمل على iOS + Android
- ✅ Lighthouse PWA Score ≥ 90
- ✅ Redis يُخزّن stores/products مؤقتاً

---

## Sprint 5 (الأسبوع 9-10)
**الهدف:** Coupons + Loyalty + PDF Invoices

### Sprint Goal
> "المنصة لديها نظام خصومات ونقاط ولاء وفواتير قابلة للتحميل"

### Stories المُختارة

| ID | Story | Hours |
|----|-------|-------|
| F02-03 | Coupons & Discounts | 14h |
| F02-04 | Loyalty Points | 11h |
| PDF Invoice Download | | 6h |
| Ratings UI (Full) | | 5h |

**Total: 36h**

### Deliverables
- ✅ Admin ينشئ كودات خصم
- ✅ العميل يُطبّق الكود في Cart
- ✅ نقاط الولاء تتراكم وتُستبدل
- ✅ فاتورة PDF تُحمَّل من صفحة الطلب
- ✅ تقييمات المتاجر والمنتجات تظهر للعملاء

---

## Sprint 6 (الأسبوع 11-12)
**الهدف:** E2E Tests + SMS + Load Testing

### Sprint Goal
> "المسارات الرئيسية مغطاة بـ E2E tests، والنظام صامد عند 500 مستخدم"

### Stories المُختارة

| ID | Story | Hours |
|----|-------|-------|
| E2E Tests (Playwright) | 4 scenarios | 16h |
| SMS Notifications (Twilio) | | 6h |
| Load Testing (Artillery) | | 4h |
| Security Scan (OWASP ZAP) | | 4h |
| README + Deployment Guide | | 6h |

**Total: 36h**

### Deliverables
- ✅ E2E tests تمر لـ Customer + Driver + Store + Admin journeys
- ✅ SMS يُرسَل عند أحداث المحفظة
- ✅ النظام صامد عند 500 concurrent users
- ✅ OWASP scan لا يُظهر Critical vulnerabilities
- ✅ README احترافي + Deployment Guide كامل

---

## Sprint 7-8 (الأسبوع 13-16)
**الهدف:** Multi-tenant DB Infrastructure

### Sprint Goal
> "البيانات معزولة بالكامل بين كل tenant"

### Stories المُختارة

| Sprint 7 | Hours |
|----------|-------|
| T55: tenant_id migration | 8h |
| T56: RLS بـ PostgreSQL | 12h |
| T57: Tenant middleware | 4h |
| T58: Data Isolation Tests | 6h |

| Sprint 8 | Hours |
|----------|-------|
| T59: Tenant Registration | 4h |
| T60: Tenant Settings | 4h |
| T61: Super Admin Panel | 5h |
| Subdomain routing | 6h |

---

## Sprint 9-10 (الأسبوع 17-20)
**الهدف:** Subscription Billing + Tenant Portal

### Sprint Goal
> "كل tenant لديه خطة اشتراك ويدفع تلقائياً"

| Story | Hours |
|-------|-------|
| T62: Stripe Billing | 8h |
| T63: Subscription Dashboard | 5h |
| T64: Usage Limits | 5h |
| Billing history | 4h |
| Invoicing per tenant | 4h |

---

## Sprint 11-12 (الأسبوع 21-24)
**الهدف:** Mobile Apps + GPS

*(تفصيل يُحدَّد عند الدخول في شهر 5)*

---

## Sprint Ceremonies

| الاجتماع | الوقت | الوتيرة |
|---------|-------|---------|
| Sprint Planning | 2 ساعة | بداية كل Sprint |
| Daily Standup | 15 دقيقة | يومياً |
| Sprint Review | 1 ساعة | نهاية كل Sprint |
| Sprint Retrospective | 45 دقيقة | نهاية كل Sprint |
| Backlog Refinement | 1 ساعة | منتصف كل Sprint |
