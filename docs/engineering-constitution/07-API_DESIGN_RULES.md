# 07 — API Design Rules
**قواعد تصميم الـ APIs الإلزامية**

---

## 1. Naming & Resource Structure

```
GET    /api/orders                  → قائمة الطلبات (الخاصة بالمستخدم)
POST   /api/orders                  → إنشاء طلب جديد
GET    /api/orders/:id              → طلب واحد
PATCH  /api/orders/:id              → تحديث جزئي
DELETE /api/orders/:id              → حذف

POST   /api/orders/:id/cancel       → action مخصص على resource
GET    /api/admin/orders            → نفس المورد، namespace مختلف (admin)

GET    /api/sub-orders/:id/otp      → nested resource
POST   /api/delivery/sub-orders/:id/offer  → action عبر namespace
```

### القواعد
```
✅ kebab-case في الـ paths
✅ plural nouns (orders, stores, products)
✅ لا أفعال في الـ path (لا /api/getOrders أو /api/createProduct)
✅ Nested resources لـ sub-resources الحقيقية
✅ Actions كـ POST على sub-resource (/api/orders/:id/cancel)
✅ Admin endpoints في /api/admin/ namespace
✅ Public (unauthenticated) endpoints في /api/public/
```

---

## 2. Versioning

```
الحالي:  /api/orders           (v1 implicit)
المستقبل: /api/v1/orders       (عند إضافة v2 فقط)
          /api/v2/orders

القاعدة:
✅ لا versioning حتى يكون هناك breaking change حقيقي
✅ v1 يبقى يعمل 3 أشهر على الأقل بعد إطلاق v2
✅ Deprecation notice في response headers: X-API-Deprecated: true
```

---

## 3. Request Validation

```typescript
// ✅ Zod على كل request body قبل أي منطق
export const updateOrderStatus = async (req: Request, res: Response) => {
  const paramsResult = z.object({
    id: z.string().uuid("معرّف غير صالح"),
  }).safeParse(req.params);

  const bodyResult = z.object({
    status: z.enum(["ACCEPTED", "READY", "CANCELLED"]),
  }).safeParse(req.body);

  if (!paramsResult.success || !bodyResult.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "بيانات غير صالحة",
      errors: {
        ...(!paramsResult.success && paramsResult.error.flatten()),
        ...(!bodyResult.success && bodyResult.error.flatten()),
      },
    });
  }
  // ...
};
```

---

## 4. Response Format (Standard)

```typescript
// ✅ نجاح مع بيانات
res.status(200).json({
  success: true,
  data: { id: "...", balance: "150.00" },
});

// ✅ نجاح مع قائمة + pagination
res.status(200).json({
  success: true,
  data: orders,
  pagination: {
    total: 85,
    page: 1,
    limit: 20,
    totalPages: 5,
    hasNext: true,
    hasPrev: false,
  },
});

// ✅ نجاح إنشاء
res.status(201).json({
  success: true,
  data: newProduct,
  message: "تم إنشاء المنتج بنجاح",
});

// ❌ ممنوع: responses غير متسقة
res.json(orders);                          // ❌ بدون wrapper
res.json({ result: orders, ok: true });   // ❌ keys مختلفة
res.json({ items: orders });              // ❌ key مختلف
```

---

## 5. Error Format (Standard)

```typescript
// ✅ نموذج الخطأ الموحّد
res.status(400).json({
  success: false,
  code: "INSUFFICIENT_BALANCE",      // machine-readable code
  message: "رصيد غير كافٍ",          // human-readable (Arabic)
  // optional:
  errors: { field: ["رسالة خطأ"] },  // Zod validation errors
});

// HTTP Status Codes المعتمدة:
// 200 OK           - نجاح
// 201 Created      - إنشاء ناجح
// 400 Bad Request  - validation error أو business rule violation
// 401 Unauthorized - لا يوجد token أو منتهٍ
// 403 Forbidden    - token صالح لكن لا صلاحية
// 404 Not Found    - المورد غير موجود
// 409 Conflict     - تعارض (code مكرر، رصيد غير كافٍ)
// 422 Unprocessable- business rule violation (invalid state transition)
// 429 Too Many     - rate limit
// 500 Server Error - خطأ غير متوقع (لا تُكشف تفاصيله)
```

---

## 6. Pagination

```typescript
// ✅ Standard Pagination Parameters
GET /api/orders?page=1&limit=20
GET /api/products?store_id=<id>&page=1&limit=50

// ✅ قيم افتراضية
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ✅ Pagination Helper
export function parsePaginationParams(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? 1)));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(query.limit ?? DEFAULT_LIMIT))));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ✅ Response يشمل pagination meta دائماً
{
  success: true,
  data: [...],
  pagination: { total, page, limit, totalPages, hasNext, hasPrev }
}
```

---

## 7. Filtering & Sorting

```typescript
// ✅ Query params للفلترة
GET /api/products?store_id=<id>&min_price=10&max_price=100
GET /api/orders?status=PENDING&from_date=2026-01-01
GET /api/admin/audit?action_type=WALLET_WITHDRAW&user_id=<id>

// ✅ Sorting
GET /api/stores?sort=rating&order=desc
GET /api/products?sort=price&order=asc

// القاعدة: لا تقبل sort بـ column مباشرة (SQL injection خطر)
const ALLOWED_SORT_FIELDS = ["price", "name", "rating", "created_at"] as const;
type SortField = typeof ALLOWED_SORT_FIELDS[number];
```

---

## 8. Authentication & Authorization

```typescript
// ✅ كل protected endpoint يحتاج: authenticate ثم authorize
router.patch(
  "/sub-orders/:id/status",
  authenticate,                              // 1. JWT valid?
  authorize(["STORE_OWNER", "ADMIN"]),       // 2. correct role?
  validateUUIDParam("id"),                   // 3. valid UUID?
  subOrderController.updateStatus,           // 4. business logic
);

// ✅ Resource-level check داخل الـ Service
async updateSubOrderStatus(subOrderId, newStatus, actorId, actorRole) {
  const subOrder = await storage.getSubOrder(subOrderId);
  if (!subOrder) throw new NotFoundError("الطلب الفرعي");

  // تأكد أن صاحب المتجر يملك هذا الطلب فقط
  if (actorRole === "STORE_OWNER") {
    const store = await storage.getStoreByOwnerId(actorId);
    if (subOrder.storeId !== store?.id) throw new Error("FORBIDDEN");
  }
}
```

---

## 9. Idempotency

```typescript
// ✅ Deposit approval: idempotent
// إذا نُفِّذت مرتين لا تُودَع مرتين
async approveDeposit(transactionId: string) {
  const tx = await storage.getTransaction(transactionId);
  if (tx.status === "COMPLETED") return; // already processed — safe to return
  // ...
}

// ✅ OTP Generation: idempotent
// generateOtp تُعيد OTP موجود إذا لم ينتهِ بعد
// (موجود بالفعل — موثق في replit.md Fix #11)

// ✅ Stripe Payments: استخدم Idempotency-Key header
await stripe.paymentIntents.create(data, {
  idempotencyKey: `deposit-${transactionId}`,
});
```

---

## 10. Backward Compatibility

```
القاعدة الذهبية: لا تكسر contracts القديمة أبداً

مسموح (backward compatible):
  ✅ إضافة field جديد لـ response (optional)
  ✅ إضافة endpoint جديد
  ✅ إضافة query parameter اختياري
  ✅ تغيير رسالة الخطأ النصية

ممنوع (breaking change):
  ❌ حذف field من response
  ❌ تغيير نوع field (string → number)
  ❌ تغيير اسم field
  ❌ تغيير HTTP method لـ endpoint موجود
  ❌ تغيير URL لـ endpoint موجود

إذا كان breaking change ضرورياً:
  1. أطلق /api/v2/<endpoint>
  2. احتفظ بـ v1 لمدة 3 أشهر
  3. أرسل Deprecation header
  4. وثّق في CHANGELOG.md
```

---

## القواعد الإلزامية

```
✦ API-01: كل endpoint له غرض واحد واضح لا أكثر
✦ API-02: كل response يتبع نفس الـ wrapper format (success + data)
✦ API-03: كل error يحتوي: code (machine) + message (Arabic human)
✦ API-04: Zod validation على كل request body قبل أي منطق
✦ API-05: UUID validation على كل :id param
✦ API-06: pagination إلزامي لكل endpoint يُعيد قوائم
✦ API-07: لا breaking changes بدون API versioning
✦ API-08: كل endpoint موثق في Swagger قبل merge
✦ API-09: لا أفعال في الـ URL — استخدم HTTP methods وصحيحها
✦ API-10: Rate limiting على جميع endpoints (general + specific لـ auth)
```
