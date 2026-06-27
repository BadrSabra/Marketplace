# 03 — Code Quality Standard
**معيار جودة الكود الإلزامي**

---

## 1. حدود الحجم

| الوحدة | الحد الأقصى | الإجراء عند التجاوز |
|--------|------------|---------------------|
| ملف Service | 300 سطر | تقسيم بمسؤوليات |
| ملف Controller | 150 سطر | استخراج helper functions |
| ملف Router | 80 سطر | sub-routers |
| React Component | 200 سطر | فصل منطق في hook |
| دالة / Method | 40 سطر | تقسيم |
| ملف عام (أي نوع) | 500 سطر | مراجعة إلزامية |

**الاستثناء الوحيد:** `shared/schema.ts` يمكن أن يتجاوز لأنه يضم جميع الـ schemas — يُراجَع عند تجاوز 600 سطر.

---

## 2. Single Responsibility Principle (SRP)

```typescript
// ❌ دالة تحمل مسؤوليتين
async function createOrderAndNotify(data: OrderData) {
  const order = await storage.createOrder(data);     // مسؤولية 1: إنشاء الطلب
  await sendPushNotification(order.storeId, "new");  // مسؤولية 2: الإشعار
  return order;
}

// ✅ كل مسؤولية في مكانها
async function createOrder(data: OrderData): Promise<Order> {
  return await storage.createOrder(data);
}
// الإشعار يُطلق من الـ Service orchestrator بعد createOrder()
```

---

## 3. DRY — Don't Repeat Yourself

**القاعدة:** أي منطق يتكرر أكثر من **مرتين** يجب تحويله إلى reusable module.

```typescript
// ❌ نفس الـ UUID validation في 5 controllers مختلفة
if (!/^[0-9a-f-]{36}$/.test(req.params.id)) {
  return res.status(400).json({ message: "Invalid ID" });
}

// ✅ helper موحد في server/utils/validation.ts
export function validateUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
}

// ✅ middleware موحد
export const requireValidUUID = (param: string) => (req, res, next) => {
  if (!validateUUID(req.params[param])) {
    return res.status(400).json({ code: "INVALID_ID", message: "معرّف غير صالح" });
  }
  next();
};
```

---

## 4. KISS — Keep It Simple

```typescript
// ❌ معقد بلا سبب
const getOrderStatus = (s: string): string =>
  ({ PENDING: "معلق", ACCEPTED: "مقبول", READY: "جاهز", DELIVERED: "مُوصَّل", CANCELLED: "ملغي" }[s] ?? "غير معروف");

// ✅ واضح ومقروء
const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "معلق",
  ACCEPTED: "مقبول",
  READY: "جاهز",
  DELIVERED: "مُوصَّل",
  CANCELLED: "ملغي",
};
const getOrderStatus = (status: string): string =>
  ORDER_STATUS_LABELS[status] ?? "غير معروف";
```

---

## 5. Explicit Typing

```typescript
// ❌ لا any
const user = jwtDecode(token) as any;

// ❌ لا implicit return types
async function getUser(id: string) {
  return storage.getUser(id); // ما نوع الـ return؟
}

// ✅ types صريحة
interface JWTPayload {
  userId: string;
  role: UserRole;
  iat: number;
  exp: number;
}
const payload = jwtDecode(token) as JWTPayload;

// ✅ return type مصرّح به
async function getUser(id: string): Promise<User | null> {
  return storage.getUser(id);
}
```

---

## 6. Error Handling

### مستويات الأخطاء

```typescript
// Level 1: Business errors (يُرميها الـ Service)
export class InsufficientBalanceError extends Error {
  readonly code = "INSUFFICIENT_BALANCE";
  constructor() { super("رصيد غير كافٍ"); }
}

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor(resource: string) { super(`${resource} غير موجود`); }
}

// Level 2: Controller يلتقطها ويحوّلها لـ HTTP response
// Level 3: errorHandler middleware يلتقط ما فات
```

### قاعدة: لا try/catch صامت
```typescript
// ❌ ابتلاع الأخطاء
try {
  await pushService.notify(userId, data);
} catch {} // ❌ الخطأ يُفقد بصمت

// ✅ تسجيل الخطأ دائماً
try {
  await pushService.notify(userId, data);
} catch (error) {
  log(`Push notification failed: ${error}`, "push-service");
  // لا throw — الإشعار ليس critical
}
```

### قاعدة: الأخطاء المالية لا تُبتلع أبداً
```typescript
// ✅ في العمليات المالية: throw دائماً
async function deductBalance(userId: string, amount: number): Promise<void> {
  const wallet = await tx.select()...
  if (parseFloat(wallet.balance) < amount) {
    throw new InsufficientBalanceError(); // ✅ لا تبتلع هذا أبداً
  }
}
```

---

## 7. Logging

```typescript
// ✅ استخدم log() للـ server-side general logs
log(`Order ${orderId} created by ${userId}`, "order-service");

// ✅ استخدم auditService.insertAuditLog() للعمليات الحساسة
await auditService.insertAuditLog({
  actionType: "WALLET_WITHDRAW",
  entityType: "WALLET",
  entityId: walletId,
  performedByUserId: actorId,
  performedByRole: actorRole,
  newValue: { amount },
});

// ❌ ممنوع في production code
console.log("DEBUG:", data);       // ❌
console.error("Error:", e);        // ❌ استخدم log() أو Sentry
console.debug("user:", user);      // ❌
```

---

## 8. Validation

```typescript
// ✅ Zod على كل request body
const createProductSchema = insertProductSchema.extend({
  price: z.number().positive("السعر يجب أن يكون موجباً"),
  stock: z.number().int().min(0),
});

export const createProduct = async (req: Request, res: Response) => {
  const result = createProductSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      errors: result.error.flatten(),
    });
  }
  // ...
};
```

---

## 9. Readability Rules

```typescript
// ✅ أسماء وصفية — لا abbreviations غير واضحة
const usr = getUser(id);     // ❌
const user = getUser(id);    // ✅

const calc = (a, b) => a + b;           // ❌
const calculateTotal = (price, qty) => price * qty; // ✅

// ✅ Magic numbers لها ثوابت
const expiresIn = 60 * 60 * 24 * 7; // ❌ ماذا يعني هذا؟
const SEVEN_DAYS_IN_SECONDS = 604800; // ✅

// ✅ Boolean variables واضحة
const d = true;           // ❌
const isDelivered = true; // ✅
```

---

## 10. Code Smells المحظورة

| Code Smell | المشكلة | الحل |
|------------|---------|------|
| Long Parameter List (> 4 params) | صعوبة الاستخدام | استخدم object parameter |
| God Function (> 40 سطر) | مسؤوليات متعددة | قسّم |
| Dead Code | يشوّش | احذف فوراً |
| Magic Numbers | لا معنى لها | ثوابت مسماة |
| Nested if > 3 مستويات | صعب القراءة | Early return pattern |
| Duplicate Logic | يصعب الصيانة | Extract function |
| TODO بدون ticket | لن يُنجز | Backlog ticket أو احذف |

```typescript
// ❌ Nested hell
if (user) {
  if (user.isApproved) {
    if (user.role === "DRIVER") {
      if (order.status === "ACCEPTED") {
        // ...
      }
    }
  }
}

// ✅ Early return (Guard Clauses)
if (!user) throw new NotFoundError("المستخدم");
if (!user.isApproved) throw new Error("ACCOUNT_PENDING");
if (user.role !== "DRIVER") throw new Error("FORBIDDEN");
if (order.status !== "ACCEPTED") throw new Error("INVALID_STATE");
// المنطق الأساسي هنا
```

---

## 11. Reusable Modules المطلوبة حالياً

```
server/utils/validation.ts   — validateUUID, validateEmail
server/utils/money.ts        — (موجود) arithmetic بـ Decimal precision
server/utils/response.ts     — createSuccessResponse, createErrorResponse
server/utils/pagination.ts   — parsePaginationParams, createPaginationMeta
server/lib/storage-provider.ts — (مطلوب) Cloud Storage abstraction
server/lib/email.ts          — Email sending abstraction
server/lib/redis.ts          — Redis client singleton
```

---

## الحكم النهائي على الكود

> **"الكود الذي يعمل لكن يضعف البنية مرفوض."**

كود مقبول يجب أن يكون:
1. **يعمل** — يحقق الـ Acceptance Criteria
2. **آمن** — لا ثغرات واضحة
3. **مقروء** — يُفهم من مطوّر آخر بعد 6 أشهر
4. **قابل للاختبار** — يمكن كتابة unit test له
5. **قابل للصيانة** — يمكن تعديله دون خوف
