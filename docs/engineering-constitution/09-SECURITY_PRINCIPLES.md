# 09 — Security Principles
**المبادئ الأمنية الإلزامية**

---

## المبدأ الأول: Security by Default

> **أي feature جديدة يجب تقييم أثرها الأمني قبل التنفيذ.**

قبل كتابة أي كود لـ feature جديدة، أجب على:
1. هل تتعامل مع بيانات حساسة (مالية، شخصية، وثائق)؟
2. هل تُضيف endpoint جديد؟ من يصل إليه؟
3. هل تُعدِّل صلاحيات أحد المستخدمين؟
4. هل تتعامل مع ملفات مرفوعة؟
5. هل تتكامل مع service خارجي؟

---

## 1. Authentication

```typescript
// ✅ JWT مع بيانات محدودة
const payload: JWTPayload = {
  userId: user.id,
  role: user.role,
  // لا تضع: password, email, phone, address في الـ payload
};
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: "30d" });

// ✅ Refresh Token stored in httpOnly cookie (مستقبل) أو localStorage مع Blacklist
// ✅ Blacklist في Redis عند logout
// ✅ bcrypt salt ≥ 12 rounds
const hash = await bcrypt.hash(password, 12);

// ❌ ممنوع
jwt.sign(payload, "secret");                        // ❌ hardcoded secret
jwt.sign(payload, process.env.JWT_SECRET!, {});    // ❌ بدون expiry
bcrypt.hash(password, 8);                           // ❌ salt rounds منخفض
```

---

## 2. Authorization — RBAC

```typescript
// ✅ Middleware stack: authenticate → authorize
router.patch(
  "/admin/users/:id/approve",
  authenticate,              // يتحقق من JWT
  authorize(["ADMIN"]),      // يتحقق من الدور
  controller.approveUser,    // المنطق
);

// ✅ Resource-level check في الـ Service
// (لا يكفي RBAC على مستوى Role فقط)
if (actorRole === "STORE_OWNER") {
  const store = await storage.getStoreByOwnerId(actorId);
  if (subOrder.storeId !== store?.id) {
    throw new Error("FORBIDDEN"); // ← resource لا يخص هذا الـ owner
  }
}

// ✅ Least Privilege: كل role يصل لما يحتاجه فقط
CUSTOMER:    orders خاصته، محفظته، متاجر عامة
STORE_OWNER: متجره، طلباته، مخزونه
DRIVER:      المهام المتاحة، طلبه النشط، محفظته
ADMIN:       كل شيء
```

---

## 3. Secrets Management

```
✦ SEC-SM01: لا secrets في الكود — دائماً env vars
✦ SEC-SM02: لا secrets في .git — .gitignore يشمل .env
✦ SEC-SM03: .env.example يحتوي أسماء المتغيرات بدون قيم حقيقية
✦ SEC-SM04: Production secrets تُدار عبر Replit Secrets أو Vault
✦ SEC-SM05: JWT_SECRET: ≥ 64 حرف عشوائي (openssl rand -base64 48)
✦ SEC-SM06: Secrets تُدوَّر دورياً (كل 6 أشهر للـ API keys)
✦ SEC-SM07: لا secrets في logs أو error messages
✦ SEC-SM08: VAPID keys خاصة بكل tenant (مستقبل)
```

---

## 4. Input Validation

```typescript
// ✅ Server-side validation دائماً (لا تثق بالـ client)
// Client validation = UX فقط، Server validation = Security

// ✅ Zod على كل input
const depositSchema = z.object({
  amount: z.number().positive().max(100000),
  receiptImage: z.string().url().optional(),
});

// ✅ UUID validation على كل :id param
// ✅ File type validation (magic bytes لا extension فقط)
// ✅ File size limit enforcement (server-side)
// ✅ String length limits (prevent DoS via large payloads)
// ✅ Numeric ranges (لا negative amounts، لا amounts > limits)

// ❌ ممنوع
const amount = req.body.amount; // ❌ استخدام مباشر بدون validation
db.query(`SELECT * FROM users WHERE id = '${req.params.id}'`); // ❌ SQL injection
```

---

## 5. SQL Injection Prevention

```typescript
// ✅ Drizzle ORM: parameterized queries دائماً
const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, email)); // parameterized

// ✅ Raw SQL (إذا لزم): استخدم sql`` tagged template
const result = await db.execute(
  sql`SELECT * FROM users WHERE email = ${email}` // parameterized
);

// ❌ ممنوع: string concatenation في SQL
const result = await db.execute(`SELECT * FROM users WHERE email = '${email}'`); // ❌
```

---

## 6. XSS Prevention

```typescript
// ✅ React يعمل escape تلقائياً لـ JSX expressions
<div>{userInput}</div>  // ✅ safe — React escapes

// ✅ Content-Security-Policy header (موجود)
"Content-Security-Policy": "default-src 'self'; script-src 'self' ..."

// ❌ ممنوع: dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userInput }} /> // ❌ NEVER

// ❌ ممنوع: innerHTML في vanilla JS
element.innerHTML = userInput; // ❌

// ✅ إذا كان HTML ضرورياً: DOMPurify أولاً
import DOMPurify from "dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
```

---

## 7. CSRF Protection

```
الحالة الحالية: JWT في localStorage (لا cookies) → لا CSRF risk مباشر
  JWT لا يُرسَل تلقائياً مع requests كما تفعل cookies

المستقبل (إذا تحولنا لـ httpOnly cookies):
  ✅ Double Submit Cookie pattern
  ✅ SameSite=Strict على الـ session cookie
  ✅ CSRF token في كل form
```

---

## 8. Rate Limiting

```typescript
// ✅ General: 1000 req/15min (موجود)
// ✅ Login: 30 req/15min (موجود)
// ✅ Register: 10/hour (موجود)
// ✅ OTP verify: 5/5min (موجود)
// ✅ Deposit: 10/hour (موجود)
// ✅ Withdraw: 5/24hour (موجود)

// مطلوب إضافته:
// ✅ Rate limiting by User ID (للـ authenticated)
// ✅ Rate limiting by tenant (للـ SaaS)
// ✅ Exponential backoff عند تكرار الفشل
```

---

## 9. Audit Logs

```typescript
// ✅ كل عملية حساسة تُسجَّل في audit_logs
// العمليات التي تتطلب Audit Log إلزامياً:
WALLET_DEPOSIT_APPROVED    // إيداع موافَق
WALLET_WITHDRAWAL          // سحب
WALLET_ADMIN_OVERRIDE      // تعديل يدوي للرصيد
USER_APPROVED              // موافقة على حساب
USER_ROLE_CHANGED          // تغيير الدور
ORDER_CANCELLED            // إلغاء طلب
STORE_DELETED              // حذف متجر
PRODUCT_DELETED            // حذف منتج
ADMIN_LOGIN                // دخول الأدمن

// ✅ Data Redaction (موجود): password, token, otp لا تُسجَّل
// ✅ Audit logs غير قابلة للتعديل أو الحذف
// ✅ تُحتفظ إلى أجل غير مسمى (compliance)
```

---

## 10. File Upload Security

```typescript
// ✅ Multer limits (موجود)
limits: { fileSize: 10 * 1024 * 1024 } // 10MB

// ✅ File type validation
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
fileFilter: (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
    return cb(new Error("INVALID_FILE_TYPE"));
  }
  cb(null, true);
}

// ✅ Magic bytes validation (مطلوب إضافته)
// MIME type من headers قابل للتزوير — تحقق من bytes الأولى

// ✅ Unique filename (لا تحتفظ باسم المستخدم الأصلي)
const filename = `${uuidv4()}.${getExtension(file.mimetype)}`;

// ✅ S3 upload مع Content-Disposition: attachment (لا inline)
```

---

## 11. Security Headers (موجودة)

```
Strict-Transport-Security (HSTS)   ✅
Content-Security-Policy (CSP)       ✅
X-Content-Type-Options: nosniff     ✅
X-Frame-Options: DENY               ✅
Referrer-Policy                     ✅
Permissions-Policy                  ✅

مطلوب:
CSRF token header                   ❌ (عند التحول لـ cookies)
```

---

## القواعد الإلزامية

```
✦ SEC-01: Security review إلزامي لأي feature تمس: Auth, Payments, Files, Admin
✦ SEC-02: لا secrets في الكود — env vars دائماً
✦ SEC-03: Zod validation على كل input قبل أي منطق
✦ SEC-04: Authentication + RBAC على كل protected endpoint
✦ SEC-05: Resource-level authorization في الـ Service (لا RBAC وحده يكفي)
✦ SEC-06: لا dangerouslySetInnerHTML بدون DOMPurify
✦ SEC-07: Audit Log على كل عملية مالية وإدارية
✦ SEC-08: لا SQL concatenation — Drizzle ORM parameterized دائماً
✦ SEC-09: HTTPS في production (Replit/Render يوفره)
✦ SEC-10: npm audit أسبوعياً — لا critical vulnerabilities في dependencies
```
