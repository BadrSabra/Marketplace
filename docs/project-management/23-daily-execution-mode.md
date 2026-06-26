# 23 — Daily Execution Mode
**دليل مدير المشروع الذكي**

---

## المبدأ الأساسي

> **لا تُنفَّذ مهمة دفعة واحدة. كل مهمة تمر بـ 7 خطوات.**  
> كل قرار يُبرَّر. كل تغيير يُفحَص. كل كود يُختبَر.

---

## 7 خطوات تنفيذ أي مهمة

---

### الخطوة 1: اختيار المهمة

**كيف تختار؟**
```
1. افتح Product Backlog (02-product-backlog.md)
2. الفلتر:
   a. Priority = Critical أو High
   b. Status = Ready (وفق DoR في 05-definition-of-ready.md)
   c. لا dependencies معلقة
3. اختر الأعلى قيمة والأقل مخاطرة
```

**مثال:**
```
المهام المتاحة اليوم:
  [P1] Cloud Storage (Critical, no deps, 3 days) ← اختر هذا
  [P2] JWT Refresh Token (Critical, needs Redis first)
  [P3] Unit Tests (High, no deps, 7 days)
  [P4] Google Maps (High, after Cloud Storage)

القرار: Cloud Storage أولاً لأنه P1 وليس له اعتمادية
```

---

### الخطوة 2: شرح سبب الاختيار

**قبل البدء في الكود، وثّق:**

```markdown
## المهمة: Cloud Storage (AWS S3)

### لماذا الآن؟
- مانع تجاري حرج: أي deployment يُفقد جميع صور المنتجات
- لا اعتمادية على مهام أخرى (يمكن البدء فوراً)
- مطلوب قبل إضافة Payment Gateway (الإيصالات تحتاج cloud)
- وقت محدود: 3 أيام — لا يؤثر على Sprint الحالي

### الأثر إذا لم تُنفَّذ:
- العميل الأول سيفقد بياناته عند أول update
- خطر R-001 في Risk Register يتحقق
```

---

### الخطوة 3: تحديد الملفات المتأثرة

**قبل لمس أي كود:**

```markdown
## الملفات التي ستتغير

### إضافة
- server/lib/storage-provider.ts (S3 client)
- server/middleware/upload.ts (Multer + S3 stream)

### تعديل
- server/modules/products/products.service.ts
  - deleteProduct() → حذف الملف من S3
  - createProduct() → رفع الصورة لـ S3
- server/modules/stores/stores.service.ts
  - deleteStore() → حذف ملفات S3
- server/routes.ts (أو auth.router.ts بعد التقسيم)
  - POST /api/profile/avatar → S3 upload

### متغيرات بيئة جديدة
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_BUCKET_NAME
- AWS_REGION

### لا تغيير في
- DB Schema (لا حاجة)
- Frontend (URLs تبقى كما هي)
- Auth (لا علاقة)
```

---

### الخطوة 4: تحديد المخاطر

```markdown
## مخاطر هذه المهمة

| الخطر | الاحتمال | الأثر | التخفيف |
|-------|---------|-------|---------|
| S3 credentials خاطئة في Production | متوسط | عالٍ | اختبار في Staging أولاً |
| رفع ملف يفشل → user يرى error غير واضح | منخفض | متوسط | Error message واضح + retry |
| تكلفة S3 غير متوقعة | منخفض | منخفض | Budget alert بـ $10 |
| الملفات القديمة في uploads/ تظل | عالٍ | منخفض | Migration script للملفات الموجودة |
| Multipart upload timeout للملفات الكبيرة | منخفض | متوسط | Limit للملفات + chunked upload |

### قرار: هل نمضي قدماً؟
✅ المخاطر قابلة للإدارة، نمضي قدماً
```

---

### الخطوة 5: التنفيذ

```markdown
## خطة التنفيذ التفصيلية

### اليوم 1
- [ ] تنصيب @aws-sdk/client-s3 و multer-s3
- [ ] إنشاء server/lib/storage-provider.ts
- [ ] اختبار اتصال S3 محلياً (بـ env vars حقيقية في dev)
- [ ] تحديث POST /api/profile/avatar لرفع S3

### اليوم 2
- [ ] تحديث products.service.ts لرفع/حذف من S3
- [ ] تحديث stores.service.ts لرفع/حذف من S3
- [ ] التعامل مع Fallback: لو S3 فشل → رفض الطلب بـ error واضح

### اليوم 3
- [ ] كتابة Unit Tests (mock S3 client)
- [ ] اختبار يدوي كامل (رفع صورة، حذف منتج، تحديث متجر)
- [ ] Migration script للملفات الموجودة
- [ ] توثيق env vars الجديدة
- [ ] PR Review + Deploy إلى Staging
```

---

### الخطوة 6: مراجعة الكود (Self-Review Checklist)

**قبل فتح PR، راجع:**

```markdown
## Self-Review Checklist

### الكود
- [ ] لا console.log بقيت
- [ ] لا any غير مبرر
- [ ] Error handling في جميع حالات S3 failure
- [ ] S3 client يُعاد استخدامه (singleton، لا إعادة إنشاء في كل request)
- [ ] Signed URLs مستخدمة للملفات الخاصة (إن وجدت)
- [ ] File type validation لا يعتمد على extension فقط (magic bytes)

### الأمان
- [ ] لا AWS credentials في الكود (env vars فقط)
- [ ] S3 Bucket policy لا تسمح بـ public read لجميع الملفات
- [ ] File size limit مطبَّق

### الأداء
- [ ] Stream مباشر إلى S3 (لا buffer في الذاكرة)

### الاختبارات
- [ ] Mock لـ S3 client في الـ tests
- [ ] اختبار upload ناجح
- [ ] اختبار upload فاشل (S3 error)
- [ ] اختبار file type validation
```

---

### الخطوة 7: كتابة الاختبارات

```typescript
// tests/storage-provider.spec.ts
describe("StorageProvider", () => {
  beforeEach(() => {
    jest.mock("@aws-sdk/client-s3");
  });

  describe("uploadFile", () => {
    it("should return public URL on success", async () => {
      mockS3.send.mockResolvedValueOnce({});
      const url = await storage.uploadFile(mockBuffer, "image/jpeg", "products");
      expect(url).toMatch(/^https:\/\/.*\.s3\..*\.amazonaws\.com\/.*/);
    });

    it("should throw UPLOAD_FAILED on S3 error", async () => {
      mockS3.send.mockRejectedValueOnce(new Error("S3 error"));
      await expect(storage.uploadFile(mockBuffer, "image/jpeg", "products"))
        .rejects.toThrow("UPLOAD_FAILED");
    });

    it("should reject non-image files", async () => {
      await expect(storage.uploadFile(mockBuffer, "application/exe", "products"))
        .rejects.toThrow("INVALID_FILE_TYPE");
    });
  });
});
```

---

## نموذج Daily Standup

```markdown
## Standup - 26 يونيو 2026

### أمس
- أنشأت server/lib/storage-provider.ts
- اختبرت اتصال S3 محلياً — يعمل

### اليوم
- تحديث products.service.ts لاستخدام S3
- كتابة Unit Tests لـ StorageProvider

### عوائق
- لا عوائق حالياً

### المخاطر الجديدة
- اكتشفت أن multer-s3 لا يدعم v3 من AWS SDK → سأستخدم stream مباشر
```

---

## نموذج قرار تقني

```markdown
## قرار: S3 vs Cloudinary

### المشكلة
نحتاج Cloud Storage لتجنب فقدان الملفات

### الخيارات

| المعيار | AWS S3 | Cloudinary |
|---------|--------|----------|
| التكلفة | أرخص (~$0.023/GB) | أغلى (free tier ثم $99/شهر) |
| Image optimization | يدوي (Sharp) | تلقائي (URL-based) |
| التعقيد | متوسط | بسيط |
| CDN | يحتاج CloudFront | مدمج |
| سيطرة على البيانات | كاملة | محدودة |

### القرار
**AWS S3** للإنتاج — أرخص، أكثر مرونة، أكثر شيوعاً.  
**Cloudinary** كبديل سهل للمشاريع الصغيرة (env variable يحدد المزود).

### التأثير
لا breaking changes — الـ URL format يتغير لكن الـ frontend لا يهتم
```

---

## مؤشرات النجاح اليومي

```
✅ مهمة واحدة على الأقل مكتملة (DoD محقق)
✅ لا regression في الـ tests
✅ PR مفتوح أو مدموج
✅ Standup محدّث
✅ Risk Register محدّث (إن وُجد خطر جديد)
✅ Technical Debt Register محدّث (إن وُجد debt جديد)
```

---

## قواعد "لا تتجاوز"

```
🚫 لا تُغيّر schema.ts بدون migration plan
🚫 لا تُعدّل wallet.service.ts بدون Unit Test يغطيها
🚫 لا تُضيف route بدون authentication middleware
🚫 لا تضع secrets في الكود
🚫 لا تدمج في main بدون Tests تمر
🚫 لا تُغيّر API response بدون تحديث Swagger
🚫 لا تنشر في Production بدون Staging test أولاً
🚫 لا تحذف DB migration — rollback script فقط
```
