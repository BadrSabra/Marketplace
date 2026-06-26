# 02 — Product Backlog
**Epics → Features → User Stories → Tasks**

---

## EPIC E01: Production Foundation
**الهدف:** إزالة العوائق التقنية الحرجة قبل أي عميل حقيقي

---

### Feature F01-01: Cloud File Storage
**الأولوية:** 🔴 Critical | **الحجم:** M

#### Story S01-01-01
**بصفتي** مستخدم، **أريد** أن تبقى صور المنتجات والمتاجر متاحة بعد كل تحديث للنظام، **حتى** لا تظهر صور مكسورة.

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T01 | تنصيب @aws-sdk/client-s3 + multer-s3 | Critical | XS | — | 1h | packages مثبتة + build يمر | TODO |
| T02 | إنشاء server/lib/storage-provider.ts | Critical | S | T01 | 4h | S3 upload/delete functions تعمل | TODO |
| T03 | تحديث upload middleware لاستخدام S3 | Critical | S | T02 | 3h | صور تُرفع لـ S3 لا uploads/ | TODO |
| T04 | تحديث products.service.ts (upload+delete) | Critical | S | T03 | 3h | delete product يحذف صورته من S3 | TODO |
| T05 | تحديث stores.service.ts (upload+delete) | Critical | S | T03 | 3h | delete store يحذف ملفاته من S3 | TODO |
| T06 | Unit Tests لـ storage-provider.ts | Critical | S | T02 | 3h | Tests تمر مع mock S3 | TODO |
| T07 | توثيق env vars الجديدة | High | XS | T02 | 1h | .env.example محدث | TODO |

---

### Feature F01-02: Payment Gateway
**الأولوية:** 🔴 Critical | **الحجم:** L

#### Story S01-02-01
**بصفتي** عميل، **أريد** إيداع رصيد بطريقة بطاقة ائتمانية فعلية، **حتى** أتمكن من الشراء فوراً.

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T08 | تنصيب Stripe SDK | Critical | XS | — | 1h | package مثبت | TODO |
| T09 | إنشاء server/lib/stripe.ts (client) | Critical | S | T08 | 2h | Stripe client يتصل بالـ API | TODO |
| T10 | POST /api/payment/create-intent | Critical | M | T09 | 4h | PaymentIntent يُنشأ بالمبلغ الصحيح | TODO |
| T11 | POST /api/payment/webhook (Stripe webhook) | Critical | M | T10 | 5h | webhook يُفعّل approveDeposit | TODO |
| T12 | Frontend: Stripe Elements component | Critical | M | T10 | 5h | بطاقة تُدخَل وتُؤكَّد | TODO |
| T13 | Integration Tests للـ payment flow | Critical | M | T11 | 4h | Stripe test mode يعمل end-to-end | TODO |
| T14 | توثيق Stripe في env vars | High | XS | T09 | 1h | .env.example محدث | TODO |

---

### Feature F01-03: JWT Security (Refresh + Blacklist)
**الأولوية:** 🔴 Critical | **الحجم:** M

#### Story S01-03-01
**بصفتي** مستخدم، **أريد** أن تنتهي جلستي فور تسجيل الخروج، **حتى** لا يستطيع أحد استخدام حسابي لو سرق الـ token.

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T15 | تنصيب ioredis + تهيئة Redis client | Critical | S | — | 2h | Redis client يتصل بالـ server | TODO |
| T16 | JWT Blacklist middleware | Critical | M | T15 | 4h | token ملغى يعيد 401 | TODO |
| T17 | POST /api/auth/logout (يضيف token للـ blacklist) | Critical | S | T16 | 2h | logout → token لا يعمل | TODO |
| T18 | POST /api/auth/refresh-token | Critical | M | T15 | 4h | refresh token يُعطي access token جديد | TODO |
| T19 | تحديث frontend لاستخدام refresh token | High | M | T18 | 3h | 401 يُطلق refresh تلقائياً | TODO |
| T20 | Unit Tests لـ Blacklist + Refresh | Critical | M | T18 | 3h | Tests تمر | TODO |

---

### Feature F01-04: تقسيم routes.ts
**الأولوية:** 🔴 Critical | **الحجم:** M

#### Story S01-04-01
**بصفتي** مطوّر، **أريد** أن يكون كل مجموعة routes في ملف منفصل، **حتى** أتمكن من صيانة الكود بسهولة.

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T21 | إنشاء server/modules/auth/auth.router.ts | Critical | S | — | 2h | auth routes تعمل | TODO |
| T22 | إنشاء server/modules/wallet/wallet.router.ts | Critical | S | — | 2h | wallet routes تعمل | TODO |
| T23 | إنشاء server/modules/orders/orders.router.ts | Critical | S | — | 2h | order routes تعمل | TODO |
| T24 | إنشاء server/modules/admin/admin.router.ts | Critical | S | — | 2h | admin routes تعمل | TODO |
| T25 | إنشاء server/modules/delivery/delivery.router.ts | Critical | S | — | 2h | delivery routes تعمل | TODO |
| T26 | تحديث server/routes.ts (mount only) | Critical | S | T21-T25 | 2h | routes.ts أصبح < 50 سطر | TODO |
| T27 | تحقق: جميع الـ Tests تمر بعد التقسيم | Critical | S | T26 | 2h | لا regression | TODO |

---

### Feature F01-05: API Documentation (Swagger)
**الأولوية:** 🔴 Critical | **الحجم:** M

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T28 | تنصيب swagger-ui-express + openapi schema | Critical | S | — | 2h | /api-docs يعمل | TODO |
| T29 | توثيق Auth endpoints | Critical | M | T28 | 3h | register/login/me موثقة | TODO |
| T30 | توثيق Wallet endpoints | Critical | M | T28 | 3h | deposit/withdraw/balance موثقة | TODO |
| T31 | توثيق Orders endpoints | Critical | M | T28 | 4h | create/list/cancel موثقة | TODO |
| T32 | توثيق Delivery endpoints | High | M | T28 | 3h | offers/OTP موثقة | TODO |
| T33 | توثيق Admin endpoints | High | M | T28 | 4h | users/stats/deposits موثقة | TODO |

---

### Feature F01-06: Unit Tests
**الأولوية:** 🔴 Critical | **الحجم:** L

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T34 | إعداد Jest + ts-jest + test DB | Critical | M | — | 3h | npm test يعمل | TODO |
| T35 | Tests لـ wallet.service.ts | Critical | M | T34 | 6h | coverage ≥ 80% | TODO |
| T36 | Tests لـ order.service.ts | Critical | M | T34 | 5h | coverage ≥ 80% | TODO |
| T37 | Tests لـ suborder.service.ts | Critical | M | T34 | 4h | state machine tests تمر | TODO |
| T38 | Tests لـ deliveryOffer.service.ts | High | M | T34 | 4h | offer acceptance test | TODO |
| T39 | Tests لـ deliveryOtp.service.ts | High | S | T34 | 3h | OTP idempotency test | TODO |

---

## EPIC E02: Market Features
**الهدف:** ميزات تنافسية وتحسين UX

---

### Feature F02-01: Google Maps / OpenStreetMap
**الأولوية:** 🟠 High | **الحجم:** M

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T40 | إضافة إحداثيات (lat/lng) لجدول stores | High | S | — | 2h | DB migration تعمل | TODO |
| T41 | خريطة تعرض موقع المتجر في صفحته | High | M | T40 | 4h | الخريطة تظهر بالموقع الصحيح | TODO |
| T42 | عرض المسافة التقريبية للعميل | High | S | T41 | 3h | "على بُعد 2.3 كم" تظهر | TODO |

---

### Feature F02-02: PWA Support
**الأولوية:** 🟠 High | **الحجم:** S

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T43 | تحديث vite-plugin-pwa | High | S | — | 2h | Lighthouse PWA score ≥ 90 | TODO |
| T44 | manifest.json (icons, theme, display) | High | S | T43 | 2h | "Add to Home Screen" يعمل | TODO |
| T45 | Service Worker للـ offline caching | High | M | T43 | 4h | الصفحة تعمل offline | TODO |

---

### Feature F02-03: Coupons & Discounts
**الأولوية:** 🟠 High | **الحجم:** L

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T46 | DB Schema: جدول coupons | High | S | — | 2h | Migration تعمل | TODO |
| T47 | POST /api/admin/coupons (إنشاء كود) | High | M | T46 | 3h | Admin يُنشئ كوداً | TODO |
| T48 | POST /api/orders/apply-coupon | High | M | T47 | 3h | الخصم يُطبَّق على الطلب | TODO |
| T49 | Frontend: حقل إدخال الكود في Cart | High | M | T48 | 3h | الخصم يظهر في الإجمالي | TODO |
| T50 | Unit Tests لـ Coupon validation | High | M | T47 | 3h | Tests تمر | TODO |

---

### Feature F02-04: Loyalty Points
**الأولوية:** 🟡 Medium | **الحجم:** M

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T51 | DB Schema: جدول loyalty_points | Medium | S | — | 2h | Migration تعمل | TODO |
| T52 | منح نقاط عند إتمام الطلب | Medium | S | T51 | 3h | نقاط تُضاف بعد DELIVERED | TODO |
| T53 | استبدال النقاط بخصم | Medium | M | T52 | 4h | 100 نقطة = 1 ج.م خصم | TODO |
| T54 | Frontend: عرض رصيد النقاط | Medium | S | T52 | 2h | يظهر في Customer Dashboard | TODO |

---

## EPIC E03: Multi-tenant SaaS
**الهدف:** تحويل المنصة إلى SaaS

---

### Feature F03-01: Tenant Infrastructure
**الأولوية:** 🔴 Critical (شهر 4) | **الحجم:** XL

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T55 | DB Migration: إضافة tenant_id لجميع الجداول | Critical | L | — | 8h | Migration بدون data loss | TODO |
| T56 | Row-Level Security (RLS) بـ PostgreSQL | Critical | L | T55 | 12h | Tenant A لا يرى بيانات Tenant B | TODO |
| T57 | Tenant middleware (قراءة tenant من subdomain/header) | Critical | M | T55 | 4h | كل request له tenant context | TODO |
| T58 | Data Isolation Tests | Critical | M | T56 | 6h | 100% zero cross-tenant leaks | TODO |

---

### Feature F03-02: Tenant Management
**الأولوية:** 🟠 High (شهر 4) | **الحجم:** L

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T59 | POST /api/tenants/register | High | M | T57 | 4h | Tenant جديد يُسجَّل | TODO |
| T60 | Tenant settings API (logo/colors/name) | High | M | T59 | 4h | Settings تُحفظ وتُطبَّق | TODO |
| T61 | Super Admin: قائمة وإدارة جميع Tenants | High | M | T59 | 5h | Admin يرى ويتحكم بالـ Tenants | TODO |

---

### Feature F03-03: Subscription Billing
**الأولوية:** 🟠 High (شهر 5) | **الحجم:** L

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T62 | Stripe Billing: Subscription Plans | High | L | T59 | 8h | Plans تُنشأ في Stripe Dashboard | TODO |
| T63 | Tenant Subscription Dashboard | High | M | T62 | 5h | Tenant يرى خطته ويغيرها | TODO |
| T64 | Usage Limits enforcement | High | M | T62 | 5h | تجاوز الحد يُوقف الطلبات | TODO |

---

## EPIC E04: Mobile & GPS
**الهدف:** تطبيقات موبايل native

---

### Feature F04-01: React Native Customer App
**الأولوية:** 🟠 High (شهر 5-6) | **الحجم:** XL

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T65 | إعداد Expo project + shared types | High | M | — | 8h | App يُبنى | TODO |
| T66 | Screens: Login, Register, Home, Stores | High | L | T65 | 20h | Navigation يعمل | TODO |
| T67 | Screens: Cart, Checkout, Orders | High | L | T65 | 16h | Order flow يعمل | TODO |
| T68 | FCM Push Notifications | High | M | T65 | 6h | Notifications تصل للموبايل | TODO |
| T69 | App Store + Play Store submission | High | M | T68 | 8h | App منشور | TODO |

---

### Feature F04-02: React Native Driver App
**الأولوية:** 🟠 High (شهر 5-6) | **الحجم:** L

| # | Task | Priority | Complexity | Deps | Hours | Acceptance Criteria | Status |
|---|------|----------|-----------|------|-------|---------------------|--------|
| T70 | Driver App: Tasks, Offers, Wallet | High | L | T65 | 20h | Driver flow يعمل | TODO |
| T71 | GPS Live Location (expo-location) | High | L | T70 | 12h | Location تُرسل للسيرفر | TODO |
| T72 | Background Location updates | High | L | T71 | 8h | Location تُحدَّث في الخلفية | TODO |

---

## ملخص الـ Backlog

```
┌─────────────────────────────────────────────────────────┐
│  EPIC               │ Stories │ Tasks │ Hours  │ Phase  │
├─────────────────────┼─────────┼───────┼────────┼────────┤
│ E01: Foundation     │    6    │  39   │ ~110h  │ شهر 1 │
│ E02: Market Features│    4    │  15   │  ~55h  │ شهر 2-3│
│ E03: Multi-tenant   │    3    │  10   │  ~61h  │ شهر 4-5│
│ E04: Mobile & GPS   │    2    │   8   │  ~98h  │ شهر 5-6│
└─────────────────────┴─────────┴───────┴────────┴────────┘
Total: ~324 estimated hours
```
