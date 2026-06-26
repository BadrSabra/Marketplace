# 13 — Testing Plan
**خطة الاختبارات الشاملة**

---

## الاستراتيجية العامة (Testing Pyramid)

```
        /\
       /E2E\          10% — بطيئة، شاملة للمسارات الرئيسية
      /──────\
     /Integr. \       20% — اختبار التكامل بين الطبقات
    /──────────\
   /  Unit Tests \    70% — سريعة، معزولة، للـ business logic
  /______________\
```

---

## 1. Unit Tests

**الأداة:** Jest + ts-jest  
**التغطية المستهدفة:** ≥ 70% على service layer

### الملفات ذات الأولوية العليا

```
server/modules/wallet/wallet.service.ts
  - approveDeposit: تأكيد ارتفاع الرصيد + ledger entry
  - withdraw: تأكيد خصم الرصيد + wallet_transaction + ledger
  - adminOverride: تأكيد audit trail
  - getOrCreateWallet: idempotency

server/modules/orders/order.service.ts
  - createMultiStoreOrder: تجميع حسب المتجر، خصم الرصيد
  - رفض الطلب عند رصيد غير كافٍ

server/modules/orders/suborder.service.ts
  - updateSubOrderStatus: state machine transitions
  - منع invalid transitions

server/modules/delivery/deliveryOffer.service.ts
  - customerAcceptOffer: خصم delivery fee + تعيين السائق + رفض بقية العروض

server/modules/delivery/deliveryOtp.service.ts
  - generateOtp: idempotency (لا يُنشئ OTP جديد إن كان موجود)
  - verifyOtp: attempt limit، expiry check

server/utils/money.ts
  - جميع العمليات الحسابية
```

### مثال Test

```typescript
// wallet.service.spec.ts
describe("WalletService.approveDeposit", () => {
  it("should increase balance and create ledger entry", async () => {
    const { userId, transactionId } = await createPendingDeposit(100);

    await walletService.approveDeposit(transactionId, adminId);

    const wallet = await getWallet(userId);
    const ledgerEntry = await getLedgerEntry(transactionId);

    expect(parseFloat(wallet.balance)).toBe(100);
    expect(ledgerEntry.type).toBe("DEPOSIT");
    expect(parseFloat(ledgerEntry.amount)).toBe(100);
  });

  it("should throw NOT_FOUND for non-existent transaction", async () => {
    await expect(walletService.approveDeposit("bad-id", adminId))
      .rejects.toThrow("NOT_FOUND");
  });

  it("should be idempotent (double approval throws)", async () => {
    const { transactionId } = await createPendingDeposit(50);
    await walletService.approveDeposit(transactionId, adminId);
    await expect(walletService.approveDeposit(transactionId, adminId))
      .rejects.toThrow();
  });
});
```

---

## 2. Integration Tests

**الأداة:** Jest + Supertest + Test Database  
**البيئة:** DATABASE_URL_TEST منفصلة

### المسارات المُختبَرة

```
🔐 Auth Flow
  POST /api/auth/register → login → GET /api/auth/me

💰 Wallet Flow
  deposit → adminApprove → checkBalance

🛒 Order Flow
  addToCart → POST /api/orders → check wallet deducted → check sub_orders created

🚗 Delivery Flow
  PATCH suborder to ACCEPTED → Driver submits offer → Customer accepts → OTP generated
  → Driver generates OTP → Customer verifies → sub_order DELIVERED → commissions paid

❌ Cancellation Flow
  order created → PATCH cancel → wallet refunded → ledger entry created

🔒 Auth Guard Tests
  CUSTOMER cannot access /api/admin/*
  DRIVER cannot POST /api/orders
  Unauthenticated gets 401
```

### Setup

```typescript
// test/setup.ts
beforeAll(async () => {
  await runMigrations(testDb);
  await seedTestData(testDb);
});

afterEach(async () => {
  await cleanTestData(testDb); // Clean between tests
});

afterAll(async () => {
  await testDb.end();
});
```

---

## 3. E2E Tests

**الأداة:** Playwright  
**البيئة:** Staging Environment

### المسارات الرئيسية

```
Scenario 1: Customer Journey
  1. يفتح الموقع كزائر → يرى المتاجر
  2. يسجل حساب جديد
  3. يودع 500 ج.م (mock receipt)
  4. يتصفح منتجات متجر
  5. يضيف 3 منتجات للسلة
  6. يُكمل الطلب
  7. يقبل عرض التوصيل
  8. يُدخل OTP ويؤكد الاستلام

Scenario 2: Store Owner Journey
  1. يسجل كـ STORE_OWNER
  2. ينتظر موافقة الأدمن
  3. يُضيف 5 منتجات
  4. يرى طلب جديد وارد
  5. يقبله ويُحدّث حالته لـ READY

Scenario 3: Driver Journey
  1. يسجل كـ DRIVER
  2. ينتظر موافقة الأدمن
  3. يرى المهام المتاحة
  4. يُقدّم عرض توصيل
  5. يُولّد OTP عند الوصول

Scenario 4: Admin Journey
  1. يُوافق على حسابات STORE_OWNER + DRIVER
  2. يُوافق على إيداع
  3. يُلغي طلباً ويتحقق من استرداد المبلغ
  4. يراجع audit logs
```

---

## 4. Load Tests

**الأداة:** Artillery  
**الهدف:** 99.5% requests < 500ms عند 500 concurrent users

```yaml
# artillery.yml
config:
  target: "https://staging.mitgaber.com"
  phases:
    - duration: 60
      arrivalRate: 10      # Warm up
    - duration: 120
      arrivalRate: 50      # Steady state
    - duration: 60
      arrivalRate: 200     # Peak load

scenarios:
  - name: "Browse stores and products"
    flow:
      - get: { url: "/api/public/stores" }
      - get: { url: "/api/products?store_id={{ storeId }}" }

  - name: "Authenticated customer"
    flow:
      - post:
          url: "/api/auth/login"
          json: { email: "test@test.com", password: "Test123!" }
          capture: { json: "$.token", as: "token" }
      - get:
          url: "/api/orders"
          headers: { Authorization: "Bearer {{ token }}" }
```

---

## 5. Stress Tests

**الهدف:** إيجاد نقطة الكسر (breaking point)

```
بدء بـ 100 concurrent users → زيادة تدريجية 100/دقيقة
مراقبة: Response time، Error rate، Memory، CPU
النقطة الحرجة: عند error rate > 1% أو P99 > 2000ms
الهدف: الكسر يحدث فوق 1000 concurrent users
```

---

## 6. Security Tests

**الأداة:** OWASP ZAP (آلية) + يدوي

```
✅ SQL Injection: جميع الـ inputs (Drizzle ORM يحمي، نتحقق)
✅ XSS: form inputs، URL params
✅ JWT Manipulation: تعديل role في JWT payload
✅ IDOR: الوصول لموارد مستخدمين آخرين بتغيير ID
✅ Rate Limit Bypass: محاولات تجاوز الـ rate limiter
✅ File Upload Bypass: رفع ملف PHP/EXE كـ image
✅ Auth Bypass: الوصول لـ protected routes بدون token
✅ Role Escalation: CUSTOMER يحاول استخدام ADMIN endpoints
✅ Mass Assignment: إرسال حقول غير مسموحة في request body
```

---

## 7. Performance Tests

```
API Response Time:
  P50 < 100ms
  P95 < 200ms
  P99 < 500ms

Frontend:
  LCP < 2.5s (Largest Contentful Paint)
  FID < 100ms (First Input Delay)
  CLS < 0.1 (Cumulative Layout Shift)

Database:
  Simple queries < 10ms
  Complex joins < 50ms
  No query > 200ms بدون index
```

---

## 8. Regression Tests

```
قبل كل Release:
  1. تشغيل Unit Tests الكاملة
  2. تشغيل Integration Tests
  3. تشغيل E2E Tests الـ 4 scenarios الرئيسية
  4. مراجعة أي failing tests
  5. لا release إذا unit test coverage انخفضت عن 65%
```

---

## 9. Accessibility Tests

**الأداة:** axe-core + Lighthouse

```
المعايير:
  WCAG 2.1 Level AA
  Color contrast ratio ≥ 4.5:1
  جميع الـ interactive elements قابلة للوصول بـ keyboard
  Arabic RTL support صحيح
  Screen reader compatibility (aria labels)
```

---

## جدول تنفيذ الاختبارات

| النوع | متى يُكتَب | من يكتبه |
|-------|-----------|---------|
| Unit Tests | مع كتابة الـ Service | Backend Engineer |
| Integration Tests | بعد الـ Service يعمل | Backend Engineer |
| E2E Tests | بعد UI جاهزة | QA Engineer |
| Load Tests | قبل كل major release | DevOps + QA |
| Security Tests | شهرياً + قبل v1.0 | Security Engineer |
| Performance | أسبوعياً (CI pipeline) | DevOps |
