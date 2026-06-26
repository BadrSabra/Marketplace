# 07 — Coding Standards
**المشروع:** مع جابر | **اللغة:** TypeScript (Frontend + Backend)

---

## 1. التسمية (Naming Conventions)

### الملفات والمجلدات
```
server/modules/wallet/wallet.service.ts    ✅ kebab-case
client/src/pages/customer/wallet.tsx       ✅ kebab-case
client/src/components/ui/notification-bell.tsx ✅ kebab-case

WalletService.ts   ❌ PascalCase للملفات
walletservice.ts   ❌ lowercase
```

### Classes & Interfaces
```typescript
class WalletService {}         ✅ PascalCase
interface IStorage {}          ✅ PascalCase (I prefix للـ interfaces)
type UserRole = "ADMIN" | ...  ✅ PascalCase للـ types
```

### Functions & Variables
```typescript
const getWalletBalance = () => {} ✅ camelCase
let isLoading = false;            ✅ camelCase
const MAX_RETRY = 3;              ✅ UPPER_SNAKE_CASE للـ constants
```

### React Components
```typescript
function NotificationBell() {}    ✅ PascalCase
const UserCard = () => {}        ✅ PascalCase
```

### Database Columns (Drizzle)
```typescript
// Schema: snake_case في DB، camelCase في TypeScript
userId: uuid("user_id")          ✅
createdAt: timestamp("created_at") ✅
```

### API Routes
```
GET  /api/wallet              ✅ kebab-case, resource noun
POST /api/orders              ✅ plural
GET  /api/orders/:id          ✅ :id للـ dynamic
POST /api/delivery/otp/verify ✅ nested resources
```

---

## 2. Architecture Rules

### Separation of Concerns
```
Controller → يستقبل الـ HTTP request، يُنظّف المدخلات، يستدعي Service، يُعيد Response
Service    → Business logic فقط، لا HTTP context
Storage    → DB queries فقط، لا business logic
```

### Dependency Direction
```
Routes → Controller → Service → Storage → DB
                              ↑
                         لا يرجع للأعلى
```

### لا يُسمح بـ:
```typescript
// ❌ DB query مباشرة في route handler
app.get("/api/wallet", async (req, res) => {
  const wallet = await db.select().from(wallets); // ❌
});

// ✅ الصواب
app.get("/api/wallet", authenticate, walletController.getBalance);
// Controller → Service → Storage
```

---

## 3. Folder Structure

```
server/modules/<feature>/
├── <feature>.controller.ts   # HTTP layer
├── <feature>.service.ts      # Business logic
├── <feature>.routes.ts       # Route definitions
└── <feature>.spec.ts         # Tests

client/src/
├── pages/<role>/<page>.tsx   # Page components
├── hooks/use-<feature>.ts    # Data hooks
├── components/<category>/    # Reusable components
└── lib/                      # Utilities
```

---

## 4. SOLID Principles

### Single Responsibility
```typescript
// ✅ WalletService يتعامل مع المحفظة فقط
// ❌ WalletService يرسل emails أيضاً — استخدم NotificationService
```

### Open/Closed
```typescript
// ✅ إضافة delivery offer type جديد بدون تعديل الكود الأصلي
// استخدم Strategy Pattern أو Factory عند الحاجة
```

### Dependency Inversion
```typescript
// ✅ Service يعتمد على interface، لا على implementation مباشرة
class WalletService {
  constructor(private readonly storage: IStorage) {}
}
```

---

## 5. DRY — Don't Repeat Yourself

```typescript
// ❌ تكرار UUID validation في كل controller
const isValidUUID = (id: string) => /^[0-9a-f-]{36}$/.test(id);
// إذا كررته أكثر من مرتين → استخرجه لـ utils/validation.ts

// ✅
import { validateUUID } from "@/utils/validation";
```

---

## 6. KISS — Keep It Simple

```typescript
// ❌ معقد بدون سبب
const getStatus = (s: string) => s === "PENDING" ? "P" : s === "ACCEPTED" ? "A" : "U";

// ✅ واضح
const STATUS_MAP = { PENDING: "P", ACCEPTED: "A" } as const;
const getStatus = (s: string) => STATUS_MAP[s as keyof typeof STATUS_MAP] ?? "U";
```

---

## 7. Error Handling

```typescript
// ✅ الأسلوب الصحيح في Controllers
export const getBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await walletService.getBalance(req.user.id);
    return res.json({ success: true, data: balance });
  } catch (error) {
    next(error); // يمرر للـ errorHandler middleware
  }
};

// ✅ Business errors تُرمى كـ typed errors
class InsufficientBalanceError extends Error {
  constructor() {
    super("INSUFFICIENT_BALANCE");
    this.name = "InsufficientBalanceError";
  }
}

// ✅ errorHandler في server/middleware/error.ts يُعالج جميع الأخطاء مركزياً
```

### HTTP Status Codes
```
200 OK           → نجح الطلب
201 Created      → تم الإنشاء
400 Bad Request  → مدخلات خاطئة (Zod validation fails)
401 Unauthorized → لا يوجد/انتهى token
403 Forbidden    → لا صلاحية (role مختلف)
404 Not Found    → المورد غير موجود
409 Conflict     → تعارض (مثل: رصيد غير كافٍ)
422 Unprocessable→ قواعد عمل مكسورة (مثل: انتقال حالة غير صالح)
429 Too Many     → rate limit
500 Server Error → خطأ غير متوقع
```

---

## 8. Logging

```typescript
// ✅ استخدم log() من server/index.ts للـ server-side logging
import { log } from "@/index";
log(`Order created: ${orderId}`, "order-service");

// ✅ استخدم auditService.insertAuditLog() لتسجيل الإجراءات الحساسة
await auditService.insertAuditLog({
  actionType: "WALLET_OVERRIDE",
  entityType: "WALLET",
  entityId: walletId,
  performedByUserId: actorId,
  performedByRole: actorRole,
  newValue: { amount },
});

// ❌ لا console.log في production code
console.log("user logged in", userId); // ❌ احذف قبل الـ PR
```

---

## 9. Comments & Documentation

```typescript
// ✅ اشرح "لماذا" لا "ماذا"
// يُستخدم FOR UPDATE لمنع race condition عند خصم الرصيد من محافظ متزامنة
const wallet = await tx.select().from(wallets)
  .where(eq(wallets.userId, userId))
  .for("update");

// ❌ تعليق يشرح "ماذا" والكود واضح بنفسه
// get user by id
const user = await storage.getUser(userId); // ❌ لا فائدة

// ✅ JSDoc للـ public service methods
/**
 * يُودع مبلغاً في محفظة المستخدم بعد موافقة الأدمن
 * @param transactionId - معرّف المعاملة المعلقة
 * @param adminId - معرّف الأدمن المُوافق
 * @throws {NotFoundError} إذا لم توجد المعاملة
 */
async approveDeposit(transactionId: string, adminId: string): Promise<void> {}
```

---

## 10. Testing Standards

```typescript
// ✅ أسلوب كتابة الـ tests
describe("WalletService", () => {
  describe("approveDeposit", () => {
    it("should increase wallet balance by approved amount", async () => {
      // Arrange
      const { walletId, transactionId } = await setupPendingDeposit(100);
      
      // Act
      await walletService.approveDeposit(transactionId, adminId);
      
      // Assert
      const wallet = await storage.getWalletByUserId(userId);
      expect(Number(wallet.balance)).toBe(100);
    });

    it("should throw if transaction not found", async () => {
      await expect(walletService.approveDeposit("non-existent", adminId))
        .rejects.toThrow("NOT_FOUND");
    });
  });
});
```

---

## 11. Frontend Standards

```typescript
// ✅ كل query لها queryKey ثابت
useQuery({
  queryKey: ["/api/wallet"],
  // queryFn محدد بشكل global في queryClient.ts
});

// ✅ كل mutation تُبطل الـ cache الصحيح
const mutation = useMutation({
  mutationFn: (data) => apiRequest("POST", "/api/orders", data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
  },
});

// ✅ دائماً Loading + Error states
if (isLoading) return <Spinner />;
if (isError) return <ErrorMessage error={error} />;
```

---

## 12. TypeScript Rules

```typescript
// ❌ لا any بدون مبرر موثق
const user = decoded as any; // ❌

// ✅ استخدم type assertions محددة
const user = decoded as JWTPayload;

// ✅ كل function لها return type صريح
async function getWallet(userId: string): Promise<Wallet | null> {}

// ✅ استخدم const assertions للـ enums
const ROLES = ["ADMIN", "CUSTOMER", "STORE_OWNER", "DRIVER"] as const;
type Role = typeof ROLES[number];
```
