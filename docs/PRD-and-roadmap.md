# وثيقة متطلبات المنتج (PRD) + خارطة الطريق التجارية والتقنية
**المشروع:** مع جابر — Hyperlocal Marketplace Platform  
**الإصدار:** 1.0  
**التاريخ:** 26 يونيو 2026  
**الأدوار:** Chief Product Officer + CTO + SaaS Business Consultant  
**طبيعة الوثيقة:** تخطيطية بحتة — لا تعديل على الكود

---

# المرحلة الأولى: الرؤية والاستراتيجية التجارية

---

## Executive Product Vision

### ما هو المنتج الحالي؟
"مع جابر" هو منصة تجارة إلكترونية محلية (Hyperlocal Marketplace) متكاملة تربط ثلاثة أطراف في منظومة واحدة: **العميل** الذي يطلب، **صاحب المتجر** الذي يُعدّ، و**السائق** الذي يُوصّل. المنصة مبنية بتقنيات حديثة (React 18 + Express 5 + PostgreSQL + Socket.IO) وتحتوي على نظام مالي مزدوج القيد، ومحادثات فورية، وإشعارات push، ونظام تفاوض فريد على رسوم التوصيل.

### ما هي المشكلة التي يحلها؟
في الأسواق الناشئة، تعاني المتاجر الصغيرة والمحلية من:
1. **غياب قناة توصيل موثوقة** — لا يمكنها استئجار سائقين بشكل دائم
2. **ارتفاع عمولات منصات التوصيل الكبرى** (25-35% من قيمة الطلب)
3. **انعدام الشفافية** في رسوم التوصيل
4. **صعوبة إدارة الطلبات والمخزون** بدون أدوات رقمية
5. **غياب نظام دفع رقمي** مدمج ومرن

للسائقين المستقلين:
- لا توجد منصة عادلة تمكّنهم من **التفاوض على أسعارهم**
- العمولات المرتفعة في المنصات الكبرى تُضعف دخلهم

### من هم العملاء؟

**العملاء المباشرون (B2B — من يشتري النظام):**
| الفئة | الوصف |
|-------|-------|
| شركات التوصيل الناشئة | تريد منصتها الخاصة بدون بناء من الصفر |
| سلاسل المتاجر المحلية | تريد نظام طلبات مع سائقين مستقلين |
| المطاعم وسلاسل الغذاء | تريد التحرر من عمولات Talabat/HungerStation |
| حاضنات ومسرّعات الأعمال | تبحث عن solutions جاهزة لعملائها |
| شركات White Label | تريد إعادة بيع المنتج بعلامتها التجارية |

**المستخدمون النهائيون (B2C — من يستخدم المنصة):**
- عملاء يطلبون من المتاجر المحلية
- أصحاب متاجر يُديرون مبيعاتهم
- سائقون مستقلون يبحثون عن دخل مرن

### ما القيمة التي يقدمها؟
- **للمتاجر:** نظام إدارة طلبات ومخزون + قناة توصيل مع سائقين مستقلين
- **للسائقين:** منصة عادلة بنظام تفاوض + محفظة رقمية + دخل مرن
- **للعملاء:** تسوق من متاجر محلية مع تتبع الطلب وتواصل مباشر
- **لمشتري النظام:** حل جاهز يوفر 12-18 شهراً من التطوير

### لماذا يشتريه العميل؟
1. **توفير الوقت:** 12-18 شهر من التطوير جاهزة
2. **توفير المال:** تكلفة بناء مماثل تتجاوز $150,000-$300,000
3. **جاهز للإنتاج:** نظام مالي، أمان، audit logs، multi-role
4. **قابل للتخصيص:** White Label بعلامته التجارية
5. **مُوثّق:** وثائق تقنية وتجارية شاملة

---

## Vision Statement

> **"أن نكون البنية التحتية الرقمية الأولى للتجارة المحلية في العالم العربي — منصة تمكّن كل متجر صغير من الوصول لعملائه، وكل سائق مستقل من بناء دخله، وكل مطوّر من إطلاق سوقه الخاص في أيام لا أشهر."**

---

## Mission Statement

> **"نبني أدوات تجارية ذكية تُعيد القوة للتجار والسائقين المستقلين، من خلال منصة مفتوحة وشفافة ونزيهة في رسوم التوصيل، تعمل لصالح الجميع لا لصالح الوسيط."**

---

## Product Positioning

### الموقع التنافسي
```
        عالي التخصيص
               ↑
    [مع جابر] ● ──────── Enterprise/White Label territory
               |
Low Cost ──────●──────── High Cost
               |
     Generic Platforms (Talabat, HungerStation)
               ↓
        منخفض التخصيص
```

**المنصة تتموضع في:** Affordable + Customizable  
أي: **تكلفة معقولة مع مرونة عالية** — وهي الفجوة التي لا تشغلها المنصات الكبرى (غالية جداً) ولا الحلول المفتوحة المصدر (تحتاج خبرة فنية عالية).

---

## تحليل المنافسين

### 1. Talabat
| الجانب | التفاصيل |
|--------|---------|
| **نقاط القوة** | قاعدة مستخدمين ضخمة، عمليات توصيل ضخمة، علامة تجارية قوية |
| **نقاط الضعف** | عمولات 25-35%، لا يمكن الشراء كـ White Label، لا يخدم المتاجر الصغيرة |
| **ما نقدمه أفضل** | عمولة مرنة قابلة للتخصيص، نظام تفاوض على رسوم التوصيل، المتجر يملك علاقة العميل |
| **ما ينقصنا** | قاعدة مستخدمين، logistics infrastructure، تطبيقات mobile native |

### 2. Jahez / HungerStation
| الجانب | التفاصيل |
|--------|---------|
| **نقاط القوة** | هيمنة سوقية في المملكة، سرعة التوصيل، fleet خاص |
| **نقاط الضعف** | حصريان لسوق معين، عمولات مرتفعة، لا يُباع كـ SaaS |
| **ما نقدمه أفضل** | قابل للنشر في أي سوق، قابل للبيع كـ SaaS/White Label |
| **ما ينقصنا** | سمعة السوق، نظام تحقق من الهوية للسائقين |

### 3. Mrsool
| الجانب | التفاصيل |
|--------|---------|
| **نقاط القوة** | نموذج فريد (السائق يختار التوصيل)، سوق سعودي قوي |
| **نقاط الضعف** | نموذج خاص بهم، لا SaaS |
| **ما نقدمه أفضل** | نظام تفاوض مماثل موجود فعلاً في كودنا! + قابل للبيع |
| **ما ينقصنا** | Mobile apps native |

### 4. Foodics
| الجانب | التفاصيل |
|--------|---------|
| **نقاط القوة** | POS system متكامل، واجهة احترافية، تكامل مع المطبخ |
| **نقاط الضعف** | يركز على المطاعم فقط، تسعير مرتفع، لا يوصّل |
| **ما نقدمه أفضل** | نظام توصيل كامل + سائقين مستقلين |
| **ما ينقصنا** | POS features، تكامل مع المطبخ (KDS)، Printer integration |

### 5. Zid / Salla
| الجانب | التفاصيل |
|--------|---------|
| **نقاط القوة** | متاجر إلكترونية احترافية، SEO، payment gateways متعددة |
| **نقاط الضعف** | لا يتعاملان مع التوصيل المحلي، لا سائقون مستقلون |
| **ما نقدمه أفضل** | نظام توصيل hyperlocal، سائقون، محادثات فورية |
| **ما ينقصنا** | SEO-friendly storefronts، payment gateways متعددة |

### 6. Shopify
| الجانب | التفاصيل |
|--------|---------|
| **نقاط القوة** | الأقوى عالمياً، apps ecosystem ضخم، موثوق جداً |
| **نقاط الضعف** | غير متخصص في hyperlocal، لا يوجد نظام سائقين، تسعير مرتفع |
| **ما نقدمه أفضل** | نظام توصيل محلي مدمج، تفاوض رسوم، OTP verification |
| **ما ينقصنا** | App ecosystem، plugin marketplace، استقرار enterprise |

### 7. GloriaFood
| الجانب | التفاصيل |
|--------|---------|
| **نقاط القوة** | مجاني للمطاعم، سهل الإعداد |
| **نقاط الضعف** | ميزات محدودة، لا سائقون، لا multi-vendor |
| **ما نقدمه أفضل** | multi-vendor حقيقي + سائقون + محادثات + إشعارات |
| **ما ينقصنا** | Freemium model |

### 8. Odoo
| الجانب | التفاصيل |
|--------|---------|
| **نقاط القوة** | ERP متكامل، accounting، HR، inventory، مفتوح المصدر |
| **نقاط الضعف** | معقد جداً، يحتاج خبرة تقنية، لا hyperlocal delivery |
| **ما نقدمه أفضل** | سهل الاستخدام، متخصص في التوصيل المحلي |
| **ما ينقصنا** | ERP features، accounting module |

### 9. Loyverse POS
| الجانب | التفاصيل |
|--------|---------|
| **نقاط القوة** | مجاني، POS خفيف، loyalty program |
| **نقاط الضعف** | لا يوصّل، لا سائقون، لا محادثات |
| **ما نقدمه أفضل** | كل ما سبق + نظام مالي متكامل |
| **ما ينقصنا** | Loyalty program، POS offline، cash management |

---

## SWOT Analysis الشامل

### Strengths (نقاط القوة الداخلية)
| # | نقطة القوة | الأثر |
|---|------------|-------|
| 1 | نظام تفاوض رسوم التوصيل — فريد في السوق | تمييز تنافسي واضح |
| 2 | Double-entry ledger مالي محترف | موثوقية مالية |
| 3 | Real-time chat + Push notifications مدمج | تجربة مستخدم متكاملة |
| 4 | 4 أدوار مستخدمين مكتملة وجاهزة | يغطي جميع أطراف المنظومة |
| 5 | TypeScript صارم + Modular architecture | سهولة الصيانة والتطوير |
| 6 | Audit logging شامل مع data redaction | جاهز للامتثال القانوني |
| 7 | Security headers + Rate limiting متقدم | أمان جيد للإنتاج |
| 8 | واجهة عربية كاملة RTL | مناسب للسوق العربي |
| 9 | OTP delivery verification | أمان التسليم |
| 10 | Open source friendly stack | لا رسوم ترخيص |

### Weaknesses (نقاط الضعف الداخلية)
| # | نقطة الضعف | الأثر |
|---|------------|-------|
| 1 | لا payment gateway (Stripe/Fawry) | يصعب الإنتاج الفعلي |
| 2 | File storage محلي (uploads/) | فقدان الملفات عند النشر |
| 3 | لا خرائط/GPS tracking | تجربة توصيل ناقصة |
| 4 | لا تطبيقات mobile native | يفوت 70% من المستخدمين |
| 5 | routes.ts ضخم (1200+ سطر) | صعوبة الصيانة |
| 6 | لا Redis/Caching | أداء محدود عند Scale |
| 7 | لا JWT blacklist | أمان ثغرة |
| 8 | Tests غير كافية | مخاطر عند التحديثات |
| 9 | لا multi-tenant | غير جاهز كـ SaaS فوراً |
| 10 | لا Coupon/Loyalty system | ينقص ميزات retention |

### Opportunities (الفرص الخارجية)
| # | الفرصة |
|---|--------|
| 1 | نمو Q-Commerce في المنطقة العربية 40% سنوياً |
| 2 | ارتفاع تكاليف المنصات الكبرى يدفع المتاجر للبحث عن بديل |
| 3 | ملايين السائقين المستقلين بدون منصة عادلة |
| 4 | White Label للشركات الناشئة في 22 دولة عربية |
| 5 | SaaS B2B في أفريقيا وجنوب آسيا حيث المنافسة أقل |
| 6 | تكامل مع Fawry/STC Pay/Mada يفتح سوق MENA كاملاً |
| 7 | طلب متزايد على hyperlocal solutions بعد جائحة كوفيد |

### Threats (التهديدات الخارجية)
| # | التهديد |
|---|--------|
| 1 | Talabat/Jahez قد يطلقون نسخ B2B/White Label |
| 2 | Shopify يُضيف delivery features |
| 3 | مطورون يبنون alternatives مفتوح المصدر |
| 4 | تغييرات تنظيمية للعمالة المؤقتة في الخليج |
| 5 | منافسة من Zid/Salla في إضافة delivery |

---

## Business Model المقترح

### النموذج الموصى به: **Hybrid Model (SaaS + White Label + Marketplace Commission)**

**السبب:**
- المشروع يحتوي بالفعل على نظام عمولات → يمكن استثماره كـ Marketplace
- قابل للتخصيص الكافي للـ White Label
- البنية التقنية قابلة للـ SaaS بتعديلات

```
┌─────────────────────────────────────────────────────┐
│                   REVENUE MODEL                      │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │    SaaS     │  │ White Label  │  │ Marketplace│  │
│  │ Subscription│  │  License +   │  │ Commission │  │
│  │  (Monthly)  │  │  Yearly Fee  │  │ per Order  │  │
│  └─────────────┘  └──────────────┘  └────────────┘  │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │              Add-on Services                    │ │
│  │  Setup Fee | Support | Training | Custom Dev    │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Revenue Streams (مصادر الدخل)

### 1. SaaS Subscription (الاشتراك الشهري/السنوي)
شركات تشغّل منصتها الخاصة على البنية التحتية لدينا.

### 2. White Label License
بيع الكود مع التخصيص الكامل + دعم فني.

### 3. Platform Commission
عمولة على كل طلب يتم على منصات الـ SaaS (0.5% - 2%).

### 4. Setup & Onboarding Fee
رسوم إعداد لمرة واحدة لكل عميل جديد ($500 - $5,000).

### 5. Premium Support & SLA
دعم فني بأولوية (24/7 Slack/Phone) مقابل اشتراك إضافي.

### 6. Training & Consulting
ورش تدريبية للفريق التقني وأصحاب المتاجر ($200-$500/session).

### 7. Custom Development
تطوير ميزات مخصصة للعملاء Enterprise بالساعة.

### 8. Mobile App Add-on
تطبيق iOS/Android بالعلامة التجارية للعميل (رسوم إضافية).

### 9. API Access (مدفوع)
لمطوري Third-party الذين يريدون بناء تطبيقات فوق المنصة.

### 10. Analytics & Reports
تقارير مالية وتحليلية متقدمة بالاشتراك.

---

## Pricing Strategy

### الباقة 1: Starter — $49/شهر (أو $470/سنة)
**مناسب لـ:** متجر واحد يريد تجربة النظام

| الميزة | متاح |
|--------|------|
| عدد المتاجر | 1 |
| عدد السائقين | 10 |
| عدد الطلبات/شهر | 200 |
| المحافظ الرقمية | ✅ |
| المحادثات | ✅ |
| الإشعارات | ✅ |
| لوحة التحكم الأساسية | ✅ |
| Subdomain فقط | ✅ |
| دعم فني | 48 ساعة |
| Custom Domain | ❌ |
| White Label | ❌ |
| API Access | ❌ |
| Mobile App | ❌ |

---

### الباقة 2: Professional — $149/شهر (أو $1,430/سنة)
**مناسب لـ:** شركة توصيل صغيرة أو سلسلة متاجر

| الميزة | متاح |
|--------|------|
| عدد المتاجر | 10 |
| عدد السائقين | 50 |
| عدد الطلبات/شهر | 2,000 |
| Custom Domain | ✅ |
| White Label (شعار وألوان) | ✅ |
| بوابة دفع إلكتروني | ✅ |
| تقارير متقدمة | ✅ |
| SMS Notifications | ✅ |
| API Access (محدود) | ✅ |
| Mobile App | إضافة $99/شهر |
| دعم فني | 24 ساعة |
| GPS Tracking | ✅ |

---

### الباقة 3: Business — $399/شهر (أو $3,830/سنة)
**مناسب لـ:** شركات متوسطة أو Marketplace إقليمي

| الميزة | متاح |
|--------|------|
| عدد المتاجر | غير محدود |
| عدد السائقين | غير محدود |
| عدد الطلبات/شهر | غير محدود |
| Multi-language | ✅ |
| Coupons & Loyalty | ✅ |
| Advanced Analytics | ✅ |
| Full API Access | ✅ |
| Custom Mobile Apps | مدمج |
| Webhook integrations | ✅ |
| Multi-currency | ✅ |
| Dedicated Support | 4 ساعات |
| SLA 99.9% Uptime | ✅ |
| Staging Environment | ✅ |

---

### الباقة 4: Enterprise — تسعير مخصص ($2,000+/شهر)
**مناسب لـ:** شركات كبيرة، مؤسسات، Multi-tenant

| الميزة | متاح |
|--------|------|
| Multi-tenant كامل | ✅ |
| Custom integrations | ✅ |
| On-premise deployment | ✅ |
| Source code access | ✅ |
| Dedicated server | ✅ |
| 24/7 Phone Support | ✅ |
| Custom SLA | ✅ |
| Custom AI features | ✅ |
| Compliance support | ✅ |
| Training sessions | مدمج |
| نسبة عمولة مخفّضة | ✅ |

---

### White Label License (بيع منفصل)
| النوع | السعر | يشمل |
|-------|-------|------|
| Basic License | $2,500 (مرة واحدة) | Source code + 3 أشهر دعم |
| Full License | $8,000 (مرة واحدة) | Source code + 12 شهر دعم + Mobile apps |
| Reseller License | $15,000/سنة | إعادة بيع لعملاء آخرين |

---

# المرحلة الثانية: خارطة طريق المنتج (6 أشهر)

---

## Product Roadmap

### الشهر الأول — Foundation & Production Readiness

**الهدف:** جعل النظام جاهزاً للإنتاج الكامل

#### Features
- [ ] تكامل بوابة دفع (Stripe أو Fawry أو كليهما)
- [ ] رفع ملفات لـ Cloud Storage (AWS S3 أو Cloudinary)
- [ ] Email verification عند التسجيل

#### Improvements
- [ ] إضافة pagination لجميع endpoints التي تفتقره
- [ ] تحسين `getStores()` لإضافة pagination
- [ ] إضافة input sanitization شاملة

#### Refactoring
- [ ] تقسيم `routes.ts` إلى Router modules منفصلة
- [ ] نقل auth routes → `server/modules/auth/`
- [ ] نقل admin routes → `server/modules/admin/`

#### Testing
- [ ] كتابة Unit Tests لـ wallet.service.ts
- [ ] كتابة Integration Tests لـ Order creation flow
- [ ] إعداد Jest + Supertest

#### Security
- [ ] إضافة JWT refresh token mechanism
- [ ] إضافة JWT blacklist (Redis-based)
- [ ] CSRF protection على الـ forms

#### Performance
- [ ] تركيب Redis للـ session management
- [ ] تفعيل compression middleware

#### Documentation
- [ ] README.md احترافي
- [ ] Installation Guide
- [ ] API Documentation (Swagger/OpenAPI)

---

### الشهر الثاني — Maps & Mobile Experience

**الهدف:** إضافة الموقع الجغرافي وتجربة Mobile

#### Features
- [ ] تكامل Google Maps / OpenStreetMap
- [ ] عرض موقع المتجر على الخريطة
- [ ] حساب المسافة التقريبية لرسوم التوصيل
- [ ] Progressive Web App (PWA) كامل
- [ ] Add to Home Screen support

#### Improvements
- [ ] تحسين تجربة Cart على mobile
- [ ] Bottom navigation للموبايل (customer)
- [ ] تحسين صفحة landing page للموبايل

#### Refactoring
- [ ] إعادة تنظيم client/src/pages/ بشكل أفضل
- [ ] فصل business logic من الـ hooks إلى services

#### Testing
- [ ] E2E Tests بـ Playwright للمسارات الرئيسية
- [ ] Tests لـ delivery offer flow كاملاً

#### Security
- [ ] إضافة Content-Security-Policy nonces للـ inline scripts
- [ ] Penetration testing أساسي

#### Performance
- [ ] Lazy loading للـ pages
- [ ] Image optimization (WebP conversion)
- [ ] Bundle splitting لتقليل أحجام الـ chunks

#### Documentation
- [ ] User Guide (Arabic)
- [ ] Driver Guide (Arabic)
- [ ] Store Owner Guide (Arabic)

---

### الشهر الثالث — Business Features & Retention

**الهدف:** إضافة ميزات تجارية لزيادة الاحتفاظ بالمستخدمين

#### Features
- [ ] نظام Coupons & Discount Codes
- [ ] نظام Loyalty Points (نقاط الولاء)
- [ ] Ratings & Reviews شاملة (UI + عرض في المتجر)
- [ ] Referral System (دعوة الأصدقاء)
- [ ] فواتير PDF قابلة للتحميل
- [ ] SMS Notifications (Twilio أو محلي)

#### Improvements
- [ ] تحسين صفحة Customer Dashboard
- [ ] إضافة Order tracking timeline
- [ ] تحسين نظام الإشعارات (grouping)

#### Refactoring
- [ ] نقل notification logic إلى Queue-based system
- [ ] تقليل coupling بين services

#### Testing
- [ ] Tests لنظام Coupons
- [ ] Load testing أساسي

#### Performance
- [ ] Redis caching لـ products list
- [ ] Redis caching لـ stores list
- [ ] Query optimization للـ admin stats

#### Documentation
- [ ] Admin Guide
- [ ] Support Guide

---

### الشهر الرابع — Multi-tenant Foundation

**الهدف:** بناء أساس الـ SaaS/Multi-tenant

#### Features
- [ ] إضافة `tenant_id` لجميع الجداول
- [ ] Tenant registration flow
- [ ] Tenant settings page (اسم، شعار، ألوان)
- [ ] Custom domain support (subdomain routing)
- [ ] Tenant admin panel منفصل
- [ ] Feature flags per tenant

#### Improvements
- [ ] تحسين performance مع بيانات multi-tenant
- [ ] تحسين admin dashboard لعرض إحصاءات per-tenant

#### Refactoring
- [ ] فصل Super Admin logic عن Tenant Admin
- [ ] إضافة Tenant context middleware

#### Testing
- [ ] Tests لعزل البيانات بين Tenants (Data Isolation)
- [ ] Tests لـ Tenant-specific settings

#### Security
- [ ] Row-level security بـ PostgreSQL (RLS)
- [ ] تأكيد عزل البيانات بين Tenants

#### Performance
- [ ] Database sharding strategy (تخطيط)
- [ ] Connection pooling per tenant

#### Documentation
- [ ] SaaS Onboarding Guide
- [ ] Tenant Admin Guide

---

### الشهر الخامس — Mobile Apps & GPS Tracking

**الهدف:** تطبيقات موبايل native + تتبع حقيقي

#### Features
- [ ] React Native app للعملاء (iOS + Android)
- [ ] React Native app للسائقين (iOS + Android)
- [ ] GPS Live Tracking للسائق
- [ ] Real-time location sharing
- [ ] Background location updates

#### Improvements
- [ ] تحسين Socket.IO مع Redis Adapter
- [ ] إضافة Connection resumption للـ chat
- [ ] Offline mode للـ driver app

#### Refactoring
- [ ] مشاركة كود مشترك بين Web و Mobile (shared/ package)
- [ ] API versioning (v1, v2)

#### Testing
- [ ] Mobile app testing (Detox)
- [ ] GPS tracking tests

#### Performance
- [ ] Optimize WebSocket connections
- [ ] Background job queue (Bull/BullMQ)

#### Documentation
- [ ] Mobile App Setup Guide
- [ ] API v2 Documentation

---

### الشهر السادس — Enterprise & Commercial Launch

**الهدف:** جاهز للبيع التجاري الكامل

#### Features
- [ ] Subscription billing system (Stripe Billing)
- [ ] Billing dashboard للـ tenants
- [ ] Usage tracking per tenant
- [ ] Invoicing system
- [ ] Enterprise SSO (SAML/OAuth)
- [ ] Advanced Analytics Dashboard
- [ ] System monitoring dashboard (Grafana)

#### Improvements
- [ ] تحسين onboarding experience
- [ ] تحسين error messages وUX
- [ ] تحسين performance اختبارات نهائية

#### Refactoring
- [ ] Code review شامل نهائي
- [ ] Dead code cleanup
- [ ] Dependency audit

#### Testing
- [ ] Security penetration testing
- [ ] Load testing (10,000 concurrent users)
- [ ] Full regression testing

#### Performance
- [ ] CDN setup (Cloudflare)
- [ ] Database read replicas
- [ ] Auto-scaling configuration

#### Documentation
- [ ] Complete API Documentation (Swagger UI)
- [ ] Developer SDK Documentation
- [ ] Security & Compliance Guide
- [ ] Release Notes v1.0

---

## Priority Matrix

### 🔴 Critical (يجب قبل أي إطلاق)
| المهمة | الجهد | الأثر |
|--------|-------|-------|
| Cloud Storage للملفات (S3/Cloudinary) | 3 أيام | فقدان البيانات عند النشر |
| Payment Gateway (Stripe أو Fawry) | 5 أيام | لا معاملات مالية حقيقية |
| JWT Refresh Token + Blacklist | 2 يوم | ثغرة أمنية |
| Redis للـ Session + Caching | 2 يوم | أداء محدود |
| تقسيم routes.ts | 3 أيام | صعوبة الصيانة |

### 🟠 High (خلال الشهر الأول)
| المهمة | الجهد | الأثر |
|--------|-------|-------|
| Unit + Integration Tests | 1 أسبوع | مخاطر عند التحديثات |
| Swagger API Documentation | 3 أيام | لازم للـ B2B sales |
| Email Verification | 1 يوم | جودة البيانات |
| PWA Support | 3 أيام | Mobile experience |
| Google Maps integration | 3 أيام | تجربة توصيل |

### 🟡 Medium (الشهر 2-3)
| المهمة | الجهد | الأثر |
|--------|-------|-------|
| Coupons & Loyalty | 1 أسبوع | Retention |
| SMS Notifications | 2 يوم | Engagement |
| PDF Invoices | 2 يوم | Professional |
| Ratings UI (Full) | 2 يوم | Trust signals |
| Referral System | 3 أيام | Growth |

### 🔵 Low (الشهر 4-6)
| المهمة | الجهد | الأثر |
|--------|-------|-------|
| Multi-tenant | 3 أسابيع | SaaS revenue |
| Mobile Apps | 6 أسابيع | Market reach |
| GPS Live Tracking | 2 أسابيع | UX premium |
| Enterprise SSO | 1 أسبوع | B2B deals |
| Advanced Analytics | 2 أسبوع | Data value |

---

## MVP النهائي (ما يجب أن يكون موجوداً للبيع)

```
✅ موجود حالياً          🔨 يحتاج إضافة
─────────────────────────────────────────
✅ Auth (JWT + RBAC)
✅ Multi-store ordering
✅ Delivery offer negotiation
✅ OTP verification
✅ Wallet system
✅ Real-time chat
✅ Push notifications
✅ Admin panel
✅ Audit logs
✅ Arabic UI

🔨 Cloud file storage
🔨 Payment gateway
🔨 Maps integration
🔨 Email verification
🔨 JWT refresh token
🔨 API documentation (Swagger)
🔨 Unit tests minimum coverage 60%
🔨 PWA support
```

---

## Enterprise Features المطلوبة

| الميزة | الأولوية | الوصف |
|--------|---------|-------|
| SSO (SAML/OAuth) | High | تسجيل دخول موحّد لفرق العمل |
| Advanced RBAC | High | أدوار مخصصة وصلاحيات دقيقة |
| Data Export (CSV/Excel) | High | تصدير بيانات كاملة |
| Dedicated Infrastructure | Medium | خوادم مخصصة |
| SLA Agreement | Medium | ضمان uptime 99.9% |
| Compliance (GDPR/PDPL) | High | لوائح حماية البيانات |
| Custom Integrations | Medium | Webhook + API مخصصة |
| On-premise Deployment | Low | تنصيب داخل بنية العميل |
| IP Whitelisting | Medium | أمان إضافي |
| 2FA / MFA | Medium | مصادقة ثنائية |
| Audit Trail Export | High | موجود، يحتاج Export |

---

## SaaS Features المطلوبة

| الميزة | الحالة | الأولوية |
|--------|--------|---------|
| **Multi-tenant** | ❌ يحتاج بناء | Critical |
| **Tenant Isolation** (Row-level) | ❌ يحتاج بناء | Critical |
| **Subscription Billing** | ❌ يحتاج بناء | Critical |
| **Usage Tracking** (orders/month) | ❌ يحتاج بناء | High |
| **Tenant Settings** (branding) | ❌ يحتاج بناء | High |
| **Custom Domains** | ❌ يحتاج بناء | High |
| **Feature Flags** per tenant | ❌ يحتاج بناء | Medium |
| **License Management** | ❌ يحتاج بناء | Medium |
| **Plans & Limits** enforcement | ❌ يحتاج بناء | High |
| **Invoicing** for tenants | ❌ يحتاج بناء | Medium |
| **Storage Limits** per tenant | ❌ يحتاج بناء | Medium |
| **Super Admin Console** | ⚠️ جزئي (Admin موجود) | High |
| **System Monitoring** | ❌ يحتاج بناء | Medium |
| **Tenant Analytics** | ❌ يحتاج بناء | Medium |

---

## White Label Features المطلوبة

| الميزة | الحالة | التعديل المطلوب |
|--------|--------|----------------|
| **Logo تخصيص** | ⚠️ يدوي | نظام dynamic logo من إعدادات |
| **الألوان (Theme)** | ⚠️ CSS variables موجودة | واجهة لتعديل الألوان ديناميكياً |
| **Brand Name** | ⚠️ يدوي | إعداد قابل للتغيير |
| **Custom Domain** | ❌ يحتاج subdomain routing | Nginx/Traefik config |
| **Email Templates** (مخصصة) | ⚠️ Nodemailer موجود | templates قابلة للتخصيص |
| **Notification Branding** | ⚠️ Push موجود | VAPID per-tenant |
| **Splash Screen** | ❌ (موبايل فقط) | React Native |
| **Mobile App Branding** | ❌ لا موبايل حالياً | يحتاج React Native |
| **App Store Branding** | ❌ لا موبايل | يحتاج React Native |
| **Customer Portal URL** | ❌ يحتاج domain routing | Nginx config |
| **Footer/Copyright** | ⚠️ يدوي | config-based |

---

## Marketplace Features (المشروع marketplace بالفعل — ما يحتاجه للتوسع)

| الميزة | الحالة | الملاحظة |
|--------|--------|---------|
| Multi-store ✅ | مكتمل | يدعم بالفعل |
| Commission system ✅ | مكتمل | ledger موجود |
| Store discovery ✅ | مكتمل | public stores page |
| Store ratings | ⚠️ جزئي | DB موجود، UI ناقص |
| Store search & filter | ⚠️ جزئي | محدود حالياً |
| Product search | ❌ لا يوجد | يحتاج search engine |
| Vendor onboarding flow | ⚠️ جزئي | يحتاج self-service |
| Vendor analytics | ⚠️ جزئي | earnings page موجودة |
| Featured stores/ads | ❌ لا يوجد | revenue opportunity |
| Store categories | ⚠️ جزئي | نص فقط |
| Dispute resolution | ❌ لا يوجد | يحتاج ticket system |

---

# المرحلة الثالثة: خارطة الطريق التقنية

---

## Technical Roadmap

### Architecture
**الحالي:** Monolithic Modular على خادم واحد  
**المستهدف (6 أشهر):** Distributed Modular مع Redis + Queue + Cloud Storage

```
CURRENT                          TARGET
───────                          ──────
Express (monolith)          →    Express + Redis + Bull Queue
Local file storage          →    AWS S3 / Cloudinary
No caching                  →    Redis Cache Layer
Socket.IO (single node)     →    Socket.IO + Redis Adapter
DB (single)                 →    DB + Read Replica
```

### Backend
| التحسين | الأولوية |
|---------|---------|
| تقسيم routes.ts إلى Router Modules | Critical |
| إضافة Redis (ioredis) | Critical |
| إضافة Bull Queue للـ background jobs | High |
| API Versioning (v1/v2) | High |
| GraphQL (اختياري للـ enterprise) | Low |
| gRPC للـ internal services (مستقبل) | Low |

### Frontend
| التحسين | الأولوية |
|---------|---------|
| Code splitting + lazy loading | High |
| PWA support كامل | High |
| React Native apps | Medium |
| Storybook لتوثيق المكونات | Medium |
| Internationalization (i18next) | High (en + ar) |
| Error boundaries شاملة | Medium |

### Database
| التحسين | الأولوية |
|---------|---------|
| tenant_id في جميع الجداول | Critical (SaaS) |
| Row-Level Security (RLS) | Critical (SaaS) |
| Read Replica | High |
| Full-text search (pg_trgm) | Medium |
| Database indexes review | High |
| Partitioning لـ audit_logs (تاريخية) | Low |

### Caching Strategy
```
Level 1: Browser Cache (HTTP headers)
Level 2: Redis Cache
  - stores list: TTL 5 min
  - products list per store: TTL 2 min  
  - admin stats: TTL 1 min
  - user sessions: TTL 7 days
Level 3: DB Connection Pool (موجود)
```

### Background Jobs (Bull Queue)
| الوظيفة | الأولوية |
|---------|---------|
| إرسال Push Notifications | High |
| إرسال Emails | High |
| معالجة صور (resize/WebP) | Medium |
| تنظيف OTPs المنتهية | Medium |
| تقارير دورية | Low |
| DB backup تلقائي | Medium |

### Storage
```
CURRENT: uploads/ محلي
TARGET:
  - AWS S3 / Cloudinary للصور
  - CDN (Cloudflare) للتوزيع
  - Signed URLs للملفات الخاصة (إيصالات، رخص)
```

### Search
```
Phase 1: PostgreSQL ILIKE / pg_trgm
Phase 2: Elasticsearch / Typesense (للـ enterprise)
```

### Notifications Architecture
```
CURRENT: Direct → Socket.IO + Web Push (sync)
TARGET:  Event → Queue → Worker → Socket.IO/Push/Email/SMS (async)
```

### Monitoring
| الأداة | الغرض |
|--------|-------|
| Prometheus + Grafana | Metrics |
| Sentry | Error tracking |
| Loki | Log aggregation |
| Uptime Robot | External monitoring |
| PgHero | Database monitoring |

### CI/CD
```
Git Push → GitHub Actions →
  1. Lint + TypeScript check
  2. Unit Tests
  3. Integration Tests
  4. Build (vite + esbuild)
  5. Docker build
  6. Push to Registry
  7. Deploy to Staging
  8. Run E2E Tests (Playwright)
  9. Manual approval
  10. Deploy to Production
  11. Health check
  12. Notify team (Slack)
```

### Testing (الاستراتيجية الكاملة)
```
70% Unit Tests (fast, isolated)
20% Integration Tests (API + DB)
10% E2E Tests (user journeys)
```

---

## Refactoring Plan

### ملفات تحتاج تقسيماً
| الملف | الحجم الحالي | المقترح |
|-------|------------|---------|
| `server/routes.ts` | ~1,200 سطر | تقسيم إلى 8+ router files |
| `client/src/App.tsx` | ~300 سطر | Router منفصل |

### هيكل routes المقترح بعد التقسيم
```
server/
├── routes.ts (entry point only, mounts routers)
└── modules/
    ├── auth/auth.router.ts
    ├── admin/admin.router.ts
    ├── orders/orders.router.ts
    ├── delivery/delivery.router.ts
    ├── wallet/wallet.router.ts
    ├── products/products.router.ts
    ├── stores/stores.router.ts
    └── public/public.router.ts
```

### خدمات تحتاج فصلاً
| الخدمة | المشكلة | الحل |
|--------|---------|------|
| Auth logic في routes.ts | مدمج مع routing | نقل إلى auth.service.ts |
| Admin stats في routes.ts | 50+ سطر بلا service | admin.service.ts |
| Storage.ts | كبير جداً | تقسيم حسب entity |

### كود مكرر
| الموقع | المشكلة |
|--------|---------|
| UUID validation في متعدد controllers | استخراج helper |
| Error response format في routes.ts | centralized error factory |
| Auth token reading في عدة صفحات | تأكد من توحيد use-auth.ts |

---

## Database Improvements

### 1. Indexes مقترحة (فوري)
```sql
-- لتسريع البحث عن طلبات المتجر
CREATE INDEX idx_sub_orders_store_id ON sub_orders(store_id);

-- لتسريع طلبات العميل
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- للبحث في المنتجات بالاسم
CREATE INDEX idx_products_name_search ON products USING gin(name gin_trgm_ops);

-- لتسريع البحث في المتاجر
CREATE INDEX idx_stores_type ON stores(type);

-- لتسريع delivery offers lookup
CREATE INDEX idx_delivery_offers_sub_order_id ON delivery_offers(sub_order_id);
CREATE INDEX idx_delivery_offers_driver_id ON delivery_offers(driver_id);
```

### 2. Schema Improvements مقترحة
```
جدول categories منفصل (بدلاً من text field)
جدول tenant_settings (للـ SaaS)
جدول coupons
جدول loyalty_points
جدول store_categories
جدول product_attributes (JSON flexible attributes)
إضافة tenant_id لجميع الجداول (للـ SaaS)
```

### 3. Data Integrity
```
- إضافة CHECK constraint على ratings (1-5)
- إضافة CHECK constraint على prices (> 0)
- إضافة ON DELETE RESTRICT على orders → customers
- تفعيل Soft delete على products و stores
```

---

## Performance Improvements

| المشكلة | الحل | الأولوية | الأثر |
|---------|------|---------|-------|
| لا caching لـ stores/products | Redis Cache (TTL 2-5 min) | Critical | تقليل DB load 70% |
| getStores() بدون pagination | Cursor-based pagination | High | Memory overflow عند Scale |
| File storage محلي | S3 + CDN | Critical | عدم فقدان البيانات |
| Socket.IO single node | Redis Adapter | High | Scale horizontal |
| N+1 في بعض الـ queries | Batch loading | High | أداء API |
| لا image optimization | Sharp + WebP | Medium | تحميل أسرع |
| لا HTTP compression | gzip/brotli | Medium | bandwidth |
| JS bundle كبير | Code splitting | Medium | FCP أسرع |

---

## Security Roadmap

### Authentication
| التحسين | الأولوية | الحالة |
|---------|---------|-------|
| JWT Refresh Token | Critical | ❌ |
| JWT Blacklist (Redis) | Critical | ❌ |
| Email Verification | High | ❌ |
| 2FA / TOTP | Medium | ❌ |
| Social Login (Google/Apple) | Low | ❌ |
| Session Fingerprinting | Medium | ❌ |

### Authorization
| التحسين | الأولوية | الحالة |
|---------|---------|-------|
| Resource-level authorization | High | ⚠️ جزئي |
| Tenant isolation (RLS) | Critical (SaaS) | ❌ |
| IP Whitelisting | Medium | ❌ |
| API Key authentication | High | ❌ |

### Encryption
| التحسين | الأولوية |
|---------|---------|
| Encryption at rest (sensitive fields) | Medium |
| HTTPS everywhere | ✅ (Replit/Render handles it) |
| Signed URLs للملفات الحساسة | High |

### OWASP Top 10 Compliance
| الثغرة | الحالة | الإجراء |
|--------|--------|---------|
| Injection | ✅ محمي (Drizzle ORM) | — |
| Broken Auth | ⚠️ جزئي | JWT blacklist |
| XSS | ✅ محمي (CSP + React) | — |
| IDOR | ⚠️ جزئي | resource-level auth |
| Security Misconfiguration | ✅ جيد | مراجعة دورية |
| Sensitive Data Exposure | ⚠️ | تشفير الحقول الحساسة |
| CSRF | ⚠️ | CSRF tokens للـ forms |
| Rate Limiting | ✅ موجود | تحسين الـ limits |

### Backup & Disaster Recovery
```
CURRENT: Manual SQL backups في backups/ (موجودة)
TARGET:
  - Automated daily DB backup → S3
  - Point-in-time recovery (PITR)
  - RTO: < 4 hours
  - RPO: < 1 hour
  - Monthly restore drills
```

---

# المرحلة الرابعة: التوثيق

---

## قائمة الوثائق المطلوبة

### للمطورين
| الوثيقة | الأولوية | الحالة |
|---------|---------|-------|
| README.md احترافي | Critical | ⚠️ يحتاج تحديث |
| Installation Guide | Critical | ❌ |
| Architecture Guide | High | ⚠️ جزئي (replit.md) |
| API Documentation (Swagger) | Critical | ❌ |
| Developer Guide | High | ❌ |
| Contribution Guide | Medium | ❌ |
| Database Schema Diagram | High | ⚠️ (هذا التقرير) |
| Environment Variables Guide | High | ❌ |
| Deployment Guide | Critical | ❌ |

### للمستخدمين
| الوثيقة | الأولوية | الحالة |
|---------|---------|-------|
| User Guide (Arabic) | High | ❌ |
| Store Owner Guide (Arabic) | High | ❌ |
| Driver Guide (Arabic) | High | ❌ |
| Admin Guide (Arabic) | High | ❌ |
| Support Guide | Medium | ❌ |

### للتجارة
| الوثيقة | الأولوية | الحالة |
|---------|---------|-------|
| Product Overview (Sales Deck) | Critical | ❌ |
| Pricing Sheet | Critical | ⚠️ (هذا التقرير) |
| Security & Compliance Guide | High | ❌ |
| Release Notes | Medium | ❌ |
| Change Log | Medium | ❌ |
| SLA Document | High | ❌ |

---

## Testing Strategy

### Unit Tests (70% من الـ test coverage)
```
Target files:
- wallet.service.ts (financial calculations)
- order.service.ts (order creation logic)
- suborder.service.ts (status transitions)
- deliveryOffer.service.ts (offer acceptance)
- deliveryOtp.service.ts (OTP validation)
- money.ts (arithmetic utility)
- auth middleware

Tools: Jest + ts-jest
Target coverage: ≥ 80% on service layer
```

### Integration Tests (20%)
```
- POST /api/auth/register → login → place order
- Full delivery offer cycle
- Wallet deposit → approval → order payment
- OTP generation → verification → delivery completion
- Chat room creation → message send

Tools: Jest + Supertest + test database
```

### E2E Tests (10%)
```
Critical user journeys:
1. Customer: Register → Browse → Add to cart → Checkout → Track order
2. Driver: Register → Browse tasks → Submit offer → Complete delivery
3. Store: Register → Add products → Accept order → Mark ready
4. Admin: Login → Approve user → Approve deposit → Check audit

Tools: Playwright
Environment: Staging
```

### Performance Tests
```
- Load testing: 1,000 concurrent users (Artillery)
- Stress testing: find breaking point
- Spike testing: sudden traffic surge
- Target: < 200ms API response P95
```

### Security Tests
```
- OWASP ZAP automated scan
- JWT token manipulation tests
- SQL injection attempts (Drizzle protects, verify)
- XSS attempt tests
- Rate limiting effectiveness tests
```

---

## DevOps Plan

### Docker Setup
```dockerfile
# Multi-stage build
Stage 1: Build (node + typescript compile)
Stage 2: Production (node:slim + dist only)

Services (docker-compose):
- app (Express + React static)
- postgres
- redis
- nginx (reverse proxy)
```

### CI/CD Pipeline
```
GitHub Actions:
1. PR → lint + typecheck + unit tests
2. Merge to main → build + integration tests
3. Tag release → build Docker → push to registry
4. Deploy to Staging → E2E tests
5. Manual approval → Deploy to Production
```

### Git Strategy
```
main (protected, production-ready)
  └── develop (integration branch)
       ├── feature/xxx (feature branches)
       ├── fix/xxx (bug fixes)
       └── release/x.x.x (release branches)

Commit convention: Conventional Commits
Versioning: Semantic Versioning (MAJOR.MINOR.PATCH)
```

### Scaling Strategy
```
Vertical Scaling (Phase 1):
  - Increase server resources

Horizontal Scaling (Phase 2):
  - Load balancer (Nginx/Cloudflare)
  - Multiple app instances
  - Redis Adapter for Socket.IO
  - DB read replicas

Serverless (Phase 3, optional):
  - Edge functions للـ public pages
  - CDN للـ static assets
```

---

# المرحلة الخامسة: الجاهزية التجارية

---

## Commercial Readiness Assessment

### التقييم الحالي: **42/100 للبيع التجاري**

```
Functionality:       75/100  ✅ (المنطق الأساسي مكتمل)
Production Readiness: 40/100  ⚠️ (بدون S3 + Payment)
Security:            65/100  ⚠️ (جيد لكن ينقص blacklist + 2FA)
Scalability:         30/100  ❌ (monolithic + no Redis)
Testing:             20/100  ❌ (غير كافٍ)
Documentation:       25/100  ❌ (ناقص جداً)
SaaS Readiness:      10/100  ❌ (لا multi-tenant)
Mobile:               0/100  ❌ (لا تطبيق موبايل)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVERAGE:             42/100
```

### ما يمنع البيع الآن
1. **❌ لا payment gateway** — المنصة لا يمكنها استقبال مدفوعات حقيقية
2. **❌ ملفات محلية** — ستُفقد عند إعادة النشر
3. **❌ لا API documentation** — لا يمكن للمطورين التكامل معها
4. **❌ لا tests كافية** — خطر عال في الإنتاج
5. **❌ لا deployment guide** — العميل لا يعرف كيف ينشر
6. **❌ لا SaaS infrastructure** — لا يمكن بيعه كـ SaaS بدون multi-tenant

### ما يجب إنجازه أولاً للوصول لـ 70/100 (MVP للبيع)
1. ✅ Cloud Storage (3 أيام)
2. ✅ Payment Gateway (5 أيام)
3. ✅ API Documentation (Swagger) (3 أيام)
4. ✅ Deployment Guide + README (2 يوم)
5. ✅ Unit Tests min 60% (7 أيام)
6. ✅ Email Verification (2 يوم)
7. ✅ JWT Refresh Token (2 يوم)

**المجموع:** ~24 يوم عمل للوصول لمستوى قابل للبيع

---

## 90-Day Business Launch Plan

### الأسبوع 1 (أيام 1-7): التحضير التقني الحرج
| اليوم | التطوير | الاختبار | التسويق/المبيعات |
|-------|---------|---------|-----------------|
| 1-2 | Cloud Storage setup (S3) | - | تحليل السوق المستهدف |
| 3-4 | Payment Gateway (Stripe) | اختبار المدفوعات | تحضير pitch deck |
| 5-6 | JWT Refresh Token | اختبار Auth | تحديد العملاء المحتملين الأوائل |
| 7 | Code review شامل | - | إنشاء صفحة landing page أولية |

---

### الأسبوع 2 (أيام 8-14): التوثيق والاختبارات
| اليوم | التطوير | الاختبار | التسويق |
|-------|---------|---------|--------|
| 8-9 | Swagger API docs | - | كتابة محتوى الموقع |
| 10-11 | Unit Tests (wallet, orders) | تشغيل الـ tests | تحضير سعر مقترح للعملاء |
| 12-13 | Integration Tests (API) | - | إنشاء حسابات LinkedIn/X للمنتج |
| 14 | README + Installation Guide | - | اختيار 5 عملاء محتملين للتجربة |

---

### الأسبوع 3 (أيام 15-21): PWA + Maps + Polishing
| اليوم | التطوير | الاختبار | المبيعات |
|-------|---------|---------|---------|
| 15-16 | PWA Support | Test on mobile | التواصل مع العملاء المحتملين الـ5 |
| 17-18 | Google Maps integration | - | تحضير Demo نسخة تجريبية |
| 19-20 | UI/UX improvements | User testing | عرض Demo للعميل الأول |
| 21 | Bug fixes | - | جمع feedback |

---

### الأسبوع 4 (أيام 22-28): Staging Environment + Beta
| اليوم | التطوير | الاختبار | المبيعات |
|-------|---------|---------|---------|
| 22-23 | Staging environment setup | - | Beta agreement مع العميل الأول |
| 24-25 | Onboarding flow improvements | Beta testing | تحديد السعر النهائي |
| 26-27 | Email templates + notifications | - | تحضير عقد |
| 28 | Security review | Penetration test أساسي | إرسال عرض للعميل الثاني |

---

### الأسبوع 5-6 (أيام 29-42): Launch Beta مع عملاء حقيقيين
| الأسبوع | التطوير | الاختبار | المبيعات |
|---------|---------|---------|---------|
| 5 | Bug fixes من Beta feedback | Load testing | متابعة عملاء Beta |
| 6 | Performance improvements | Monitoring setup | إغلاق أول عقد |

---

### الأسبوع 7-8 (أيام 43-56): Coupons + Ratings + Improvements
| الأسبوع | التطوير | الاختبار | المبيعات |
|---------|---------|---------|---------|
| 7 | Coupons & Loyalty MVP | Tests | تحضير case study من Beta |
| 8 | Ratings UI + Store reviews | - | نشر case study |

---

### الأسبوع 9-10 (أيام 57-70): SMS + PDF + Enhanced Admin
| الأسبوع | التطوير | الاختبار | المبيعات |
|---------|---------|---------|---------|
| 9 | SMS Notifications (Twilio) | - | استهداف 10 عملاء جدد |
| 10 | PDF Invoices + Enhanced Analytics | - | Webinar تعريفي للمنتج |

---

### الأسبوع 11-12 (أيام 71-84): Multi-tenant Foundation + Commercial Pricing
| الأسبوع | التطوير | الاختبار | المبيعات |
|---------|---------|---------|---------|
| 11 | Multi-tenant DB changes | Isolation tests | SaaS pricing announcement |
| 12 | Tenant settings + Custom domain | - | Launch SaaS plan رسمياً |

---

### الأسبوع 13 (أيام 85-90): Official Commercial Launch
| النشاط | التفاصيل |
|--------|---------|
| **Commercial Launch** | إطلاق رسمي للمنتج |
| **Press Release** | نشر في وسائل التكنولوجيا العربية |
| **Partner Program** | إطلاق برنامج الشركاء (Resellers) |
| **Product Hunt Launch** | نشر على Product Hunt |
| **Free Trial** | 14 يوم مجاناً للمشتركين الجدد |
| **Target Customers** | 10 عملاء مدفوعين بنهاية اليوم 90 |

---

## الأهداف التجارية بنهاية 90 يوم
```
العملاء المدفوعون:    ≥ 10 عملاء
MRR (Monthly Revenue): $2,000 - $5,000
عملاء Beta:           ≥ 3 عملاء نشطون
NPS Score:            ≥ 50
Bug Rate:             < 1 critical bug/week
Uptime:               ≥ 99.5%
```

---

## ملخص خارطة الطريق 6 أشهر

```
شهر 1:  Foundation (Storage + Payment + Tests + Docs)
شهر 2:  Maps + PWA + Mobile UX
شهر 3:  Business Features (Coupons + Loyalty + Ratings)
شهر 4:  Multi-tenant Foundation
شهر 5:  Mobile Apps + GPS
شهر 6:  Enterprise + Commercial Launch
         ↓
المنتج ينتقل من: 42/100 → 85/100
```

---

*انتهت وثيقة PRD وخارطة الطريق — تاريخ الإعداد: 26 يونيو 2026*  
*هذه وثيقة تخطيطية بحتة — لم يُعدَّل أي ملف أثناء إعدادها*
