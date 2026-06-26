# 10 — Release Plan
**خطة الإصدارات القادمة**

---

## v1.0.0 — Production Foundation
**الهدف:** المنتج جاهز للعملاء الأوائل  
**الجدول:** شهر 1 (4 أسابيع)

### ما يشمله
- ✅ **Cloud Storage:** رفع الملفات إلى AWS S3 أو Cloudinary (صور المنتجات، المتاجر، الإيصالات، الأفاتار)
- ✅ **Payment Gateway:** تكامل Stripe لقبول مدفوعات حقيقية
- ✅ **JWT Refresh Token:** تجديد الجلسة تلقائياً بدون إعادة تسجيل دخول
- ✅ **JWT Blacklist:** إلغاء tokens عند تسجيل الخروج
- ✅ **routes.ts split:** تقسيم الملف الضخم إلى Router modules
- ✅ **Unit Tests:** coverage ≥ 65% على Service layer
- ✅ **Swagger API Docs:** توثيق جميع endpoints
- ✅ **Email Verification:** تأكيد البريد عند التسجيل
- ✅ **README + Deployment Guide:** كامل ومفصّل

### Breaking Changes
- لا يوجد (backward compatible)

### Migration Required
```
إضافة env vars:
AWS_ACCESS_KEY_ID، AWS_SECRET_ACCESS_KEY، AWS_BUCKET
أو: CLOUDINARY_URL

STRIPE_SECRET_KEY، STRIPE_WEBHOOK_SECRET

REDIS_URL (للـ JWT blacklist)
```

---

## v1.1.0 — Maps & Mobile Experience
**الهدف:** تحسين تجربة التوصيل والموبايل  
**الجدول:** شهر 2

### ما يشمله
- ✅ **Google Maps / OpenStreetMap:** عرض موقع المتجر + حساب مسافة تقريبية
- ✅ **PWA Support:** تطبيق ويب قابل للتنصيب على الموبايل
- ✅ **Redis Caching:** تخزين مؤقت للمتاجر والمنتجات (TTL: 2-5 دقائق)
- ✅ **Socket.IO Redis Adapter:** لدعم multi-instance
- ✅ **SMS Notifications:** عبر Twilio لأحداث المحفظة والطلبات
- ✅ **Integration Tests:** للمسارات الرئيسية (Order + Wallet + Delivery)

### Breaking Changes
- لا يوجد

### Migration Required
```
MAPS_API_KEY (Google Maps)
أو: لا شيء (OpenStreetMap مجاني)
REDIS_URL (إن لم يُضَف في v1.0.0)
TWILIO_ACCOUNT_SID، TWILIO_AUTH_TOKEN، TWILIO_FROM_NUMBER
```

---

## v1.2.0 — Business Features & Retention
**الهدف:** ميزات تجارية لزيادة الاحتفاظ  
**الجدول:** شهر 3

### ما يشمله
- ✅ **Coupons & Discount Codes:** إنشاء وإدارة وتطبيق كودات الخصم
- ✅ **Loyalty Points:** نقاط ولاء لكل طلب مكتمل
- ✅ **Referral System:** مكافأة دعوة الأصدقاء
- ✅ **PDF Invoice:** تحميل فاتورة PDF لكل طلب
- ✅ **Full Ratings UI:** عرض التقييمات في صفحة المتجر العام
- ✅ **E2E Tests:** Playwright للمسارات الرئيسية
- ✅ **Load Testing:** تحقق من صمود النظام عند 500 مستخدم متزامن

### Breaking Changes
- إضافة حقول جديدة لـ `orders` response (optional, backward compatible)

### Migration Required
```
DB Migration: إضافة جداول coupons، loyalty_points، referrals
```

---

## v2.0.0 — Multi-tenant SaaS (MAJOR)
**الهدف:** تحويل المنصة إلى SaaS قابل للبيع  
**الجدول:** شهر 4

### ما يشمله
- ✅ **tenant_id:** إضافة لجميع جداول DB
- ✅ **Row-Level Security (RLS):** عزل بيانات كل tenant
- ✅ **Tenant Registration:** تسجيل tenant جديد بنفسه
- ✅ **Tenant Settings:** شعار، ألوان، اسم النظام
- ✅ **Custom Subdomains:** tenant1.mitgaber.com
- ✅ **Subscription Billing:** Stripe Billing للخطط
- ✅ **Super Admin Console:** إدارة جميع tenants
- ✅ **Feature Flags:** تفعيل/تعطيل ميزات per tenant
- ✅ **Usage Tracking:** مراقبة استخدام كل tenant

### ⚠️ Breaking Changes
```
DB Schema: tenant_id مُضاف لجميع الجداول
API: استجابات تحتوي على tenant context
Auth: JWT يحتوي على tenant_id
```

### Migration Required
```
DB Migration ضخمة: إضافة tenant_id + RLS policies
جميع existing data تُنسب لـ tenant_id = default_tenant
بيئة Staging يجب اختبار Migration عليها أولاً
```

---

## v2.1.0 — Tenant Portal & Analytics
**الهدف:** لوحة تحكم كاملة لكل tenant  
**الجدول:** شهر 5

### ما يشمله
- ✅ **Tenant Admin Portal:** لوحة تحكم مخصصة لكل tenant
- ✅ **Billing Dashboard:** فواتير، استخدام، ترقية خطة
- ✅ **Advanced Analytics:** مبيعات، سائقون، عملاء — per tenant
- ✅ **White Label Email:** templates بعلامة tenant
- ✅ **API Keys:** للـ third-party integrations
- ✅ **Webhook Support:** إرسال events لـ external systems

---

## v3.0.0 — Mobile Apps & GPS (MAJOR)
**الهدف:** تطبيقات موبايل native  
**الجدول:** شهر 6

### ما يشمله
- ✅ **React Native: Customer App** (iOS + Android)
- ✅ **React Native: Driver App** (iOS + Android)
- ✅ **GPS Live Tracking:** تتبع السائق في الوقت الحقيقي
- ✅ **Background Location:** تحديث الموقع في الخلفية
- ✅ **Mobile Push (FCM/APNs):** إشعارات push native
- ✅ **App Store + Play Store:** نشر رسمي

### ⚠️ Breaking Changes
```
API v2: endpoints مُحسَّنة للموبايل
Location data schema جديد
```
