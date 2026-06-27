# 05 — Naming Conventions
**قواعد التسمية الإلزامية**

---

## 1. الملفات (Files)

| النوع | القاعدة | مثال صحيح ✅ | مثال خاطئ ❌ |
|-------|---------|------------|------------|
| Server modules | kebab-case | `wallet.service.ts` | `WalletService.ts` |
| React pages | kebab-case | `customer/wallet.tsx` | `CustomerWallet.tsx` |
| React components | kebab-case | `notification-bell.tsx` | `NotificationBell.tsx` |
| React hooks | `use-` prefix + kebab | `use-chat-socket.ts` | `chatSocket.ts` |
| Utilities | kebab-case | `storage-provider.ts` | `StorageProvider.ts` |
| Tests | نفس الملف + `.spec` | `wallet.service.spec.ts` | `wallet.test.ts` |
| Constants | UPPER_SNAKE | `ORDER_STATUS.ts` | `orderStatus.ts` |

**السبب:** kebab-case يعمل على جميع أنظمة التشغيل (case-insensitive macOS vs Linux).

---

## 2. المجلدات (Folders)

| النوع | القاعدة | مثال صحيح ✅ | مثال خاطئ ❌ |
|-------|---------|------------|------------|
| Server modules | kebab-case | `server/modules/delivery-offers/` | `DeliveryOffers/` |
| Client pages | kebab-case | `client/src/pages/store-owner/` | `StoreOwner/` |
| Client features | kebab-case | `client/src/components/chat/` | `Chat/` |

---

## 3. المتغيرات (Variables)

```typescript
// ✅ camelCase للمتغيرات العادية
const walletBalance = 100.50;
const isApproved = true;
const currentUser = await getUser(id);

// ✅ UPPER_SNAKE_CASE للثوابت
const MAX_LOGIN_ATTEMPTS = 5;
const JWT_EXPIRES_IN = "7d";
const DELIVERY_COMMISSION_RATE = 0.15;

// ✅ _ prefix للـ private class properties (convention)
class WalletService {
  private _cache = new Map();
}

// ❌ ممنوع
const wb = 100;          // abbreviation غير واضح
const WalletBalance = 100; // PascalCase للمتغيرات
const wallet_balance = 100; // snake_case في TypeScript
```

---

## 4. الدوال (Functions)

```typescript
// ✅ camelCase + فعل وصفي
async function getWalletBalance(userId: string): Promise<Wallet> {}
async function createOrder(data: InsertOrder): Promise<Order> {}
async function validateCouponCode(code: string): Promise<boolean> {}
async function sendDeliveryNotification(driverId: string): Promise<void> {}

// ✅ Boolean functions تبدأ بـ is/has/can/should
function isValidUUID(id: string): boolean {}
function hasPermission(user: User, action: string): boolean {}
function canCancelOrder(status: OrderStatus): boolean {}

// ✅ Event handlers في React تبدأ بـ handle
const handleSubmit = () => {};
const handleOrderCancel = () => {};

// ❌ ممنوع
async function process(d: any) {}     // غير وصفي
async function DoWork() {}            // PascalCase للـ functions
async function get_balance() {}       // snake_case في TypeScript
```

---

## 5. Classes & Interfaces

```typescript
// ✅ PascalCase للـ classes
class WalletService {}
class OrderController {}
class StorageProvider {}

// ✅ PascalCase + I prefix للـ interfaces
interface IStorage {}
interface IEmailProvider {}

// ✅ PascalCase للـ types
type UserRole = "ADMIN" | "CUSTOMER" | "STORE_OWNER" | "DRIVER";
type OrderStatus = "PENDING" | "ACCEPTED" | "READY" | "DELIVERED" | "CANCELLED";

// ✅ PascalCase للـ Enums (اجتنب enums في TypeScript — استخدم const)
const TRANSACTION_TYPE = {
  DEPOSIT: "DEPOSIT",
  WITHDRAWAL: "WITHDRAWAL",
  COMMISSION: "COMMISSION",
} as const;

// ❌ ممنوع
class walletService {}  // lowercase
interface Storage {}    // بدون I prefix للـ interfaces
```

---

## 6. DB Tables & Columns

```
جداول DB: snake_case + plural
  ✅ users, wallets, wallet_transactions, sub_orders
  ❌ User, Wallets, walletTransactions

أعمدة DB: snake_case
  ✅ user_id, created_at, is_approved, store_owner_id
  ❌ userId, createdAt, isApproved

TypeScript properties (Drizzle): camelCase (auto-mapped)
  ✅ userId, createdAt, isApproved
```

```typescript
// ✅ الصواب في Drizzle
export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletId: uuid("wallet_id").notNull(),        // camelCase في TS
  transactionType: text("transaction_type"),     // snake_case في DB
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## 7. API Endpoints

```
القاعدة: REST conventions
  GET    /api/<resource>           → قائمة
  POST   /api/<resource>           → إنشاء
  GET    /api/<resource>/:id       → واحد
  PATCH  /api/<resource>/:id       → تحديث جزئي
  DELETE /api/<resource>/:id       → حذف
  POST   /api/<resource>/:id/<action> → action على resource

التسمية: kebab-case, plural, lowercase
  ✅ /api/wallet-transactions
  ✅ /api/delivery-offers
  ✅ /api/sub-orders/:id/status
  ✅ /api/admin/users/:id/approve
  ❌ /api/walletTransactions    (camelCase)
  ❌ /api/DeliveryOffer         (PascalCase)
  ❌ /api/suborder              (singular)
```

---

## 8. Socket.IO Events

```typescript
// Client → Server: فعل + مفعول (snake_case)
socket.emit("join_room", { roomId });
socket.emit("send_message", { roomId, content });
socket.emit("mark_read", { roomId });

// Server → Client: اسم + وصف (snake_case)
socket.emit("new_message", message);
socket.emit("unread_update", { count });
socket.emit("marked_read", { roomId });

// ❌ ممنوع
socket.emit("joinRoom", ...);    // camelCase
socket.emit("JOIN_ROOM", ...);   // UPPER_CASE
socket.emit("join-room", ...);   // kebab-case
```

---

## 9. Constants

```typescript
// ✅ UPPER_SNAKE_CASE في ملف constants منفصل أو في أول الملف
export const MAX_WITHDRAWAL_AMOUNT = 10000;
export const OTP_EXPIRY_MINUTES = 10;
export const BCRYPT_SALT_ROUNDS = 12;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const DELIVERY_COMMISSION_PERCENTAGE = 15; // 15%

// ✅ as const للـ enums المُنشأة كـ objects
export const ORDER_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  READY: "READY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];
```

---

## 10. React Components & Props

```typescript
// ✅ PascalCase للـ Component
function WalletCard({ balance, currency }: WalletCardProps) {}

// ✅ PascalCase + Props suffix للـ Props interface
interface WalletCardProps {
  balance: string;
  currency?: string;
  onDeposit: () => void;    // callbacks تبدأ بـ on
}

// ✅ data-testid: kebab-case وصفي
<button data-testid="button-submit-deposit">...</button>
<input data-testid="input-amount" />
<div data-testid={`card-order-${order.id}`}>...</div>
```

---

## ملخص سريع

| السياق | القاعدة |
|--------|---------|
| ملفات + مجلدات | kebab-case |
| Variables + Functions | camelCase |
| Classes + Types + Interfaces | PascalCase |
| Constants | UPPER_SNAKE_CASE |
| DB Tables + Columns | snake_case |
| API Endpoints | kebab-case, plural |
| Socket Events | snake_case |
| React Components | PascalCase |
| React Props | camelCase |
| Boolean functions | is/has/can prefix |
| Callbacks | on/handle prefix |
