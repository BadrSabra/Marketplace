# 10 — Testing Philosophy
**فلسفة الاختبارات وقواعدها**

---

## الفلسفة الأساسية

> **"الاختبار ليس عبئاً إضافياً — هو جزء من التنفيذ."**  
> كود بدون اختبارات هو كود بدون ضمان.

```
Testing Pyramid:
                   ╱╲
                  ╱E2E╲          ← قليل، ثمين، بطيء
                 ╱──────╲
                ╱Integrat╲       ← متوسط، للمسارات الحرجة
               ╱──────────╲
              ╱  Unit Tests ╲     ← كثير، سريع، أساس البنية
             ╱──────────────╲
```

---

## 1. Unit Tests

**التعريف:** اختبار وحدة واحدة (function, class, module) بعزل تام.

**ما يُختبَر بـ Unit Tests:**
- `wallet.service.ts` — كل method (balance check, deduction, deposit approval)
- `order.service.ts` — state transitions
- `suborder.service.ts` — status machine (PENDING → ACCEPTED → READY)
- `deliveryOffer.service.ts` — offer acceptance, counter, rejection
- `deliveryOtp.service.ts` — OTP generation, idempotency, expiry
- `storage-provider.ts` — S3 upload/delete (mocked)
- `coupon.service.ts` — validation, apply, expiry
- Utility functions — money.ts, validation.ts

**الحد الأدنى المطلوب:**
```
Service layer:  ≥ 80% line coverage
Utils:          ≥ 90% line coverage
Controllers:    ≥ 50% (الباقي covered بـ Integration)
```

**مثال:**
```typescript
// wallet.service.spec.ts
describe("WalletService.deductBalance", () => {
  let service: WalletService;
  let mockStorage: jest.Mocked<IStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    service = new WalletService(mockStorage, mockAuditService, mockPushService);
  });

  it("should deduct balance successfully", async () => {
    mockStorage.getWallet.mockResolvedValue({ id: "w1", balance: "200.00" });
    mockStorage.updateWallet.mockResolvedValue({ id: "w1", balance: "150.00" });

    await service.deductBalance("u1", 50);

    expect(mockStorage.updateWallet).toHaveBeenCalledWith("w1", { balance: "150.00" });
  });

  it("should throw INSUFFICIENT_BALANCE when balance is too low", async () => {
    mockStorage.getWallet.mockResolvedValue({ id: "w1", balance: "30.00" });

    await expect(service.deductBalance("u1", 50)).rejects.toThrow("INSUFFICIENT_BALANCE");
    expect(mockStorage.updateWallet).not.toHaveBeenCalled();
  });

  it("should be atomic — use DB transaction", async () => {
    // تأكد أن الدالة تستخدم tx لا db مباشرة
    await service.deductBalance("u1", 50);
    expect(mockStorage.runTransaction).toHaveBeenCalled();
  });
});
```

---

## 2. Integration Tests

**التعريف:** اختبار endpoint كامل (HTTP Request → Controller → Service → DB مـock).

**ما يُختبَر بـ Integration Tests:**
- Auth flow: register → login → me → logout
- Wallet flow: deposit request → admin approve → balance update
- Order flow: create → store accept → driver offer → customer accept → OTP → delivered
- Admin flow: user approval, store management
- Chat flow: room creation، message sending

**الحد الأدنى:** جميع المسارات الحرجة (Happy Path + Main Error Cases)

**مثال:**
```typescript
// wallet.integration.spec.ts
describe("POST /api/wallet/deposit", () => {
  it("should create deposit request", async () => {
    const { token } = await loginAs("customer");

    const response = await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100, receiptImage: "https://..." });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("PENDING");
  });

  it("should reject unauthenticated requests", async () => {
    const response = await request(app).post("/api/wallet/deposit").send({ amount: 100 });
    expect(response.status).toBe(401);
  });

  it("should reject negative amounts", async () => {
    const { token } = await loginAs("customer");
    const response = await request(app)
      .post("/api/wallet/deposit")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: -50 });
    expect(response.status).toBe(400);
  });
});
```

---

## 3. E2E Tests (End-to-End)

**الأداة:** Playwright  
**العدد المستهدف:** 4-8 scenarios تغطي المسارات الأساسية لكل Role

**Scenarios المطلوبة:**

| # | السيناريو | الـ Roles |
|---|-----------|----------|
| E2E-01 | تسجيل مستخدم جديد + تسجيل دخول | Customer |
| E2E-02 | إيداع رصيد → موافقة أدمن → عرض الرصيد | Customer + Admin |
| E2E-03 | إنشاء طلب → قبول المتجر → عرض العميل | Customer + Store |
| E2E-04 | عرض مهام السائق → تقديم عرض → قبول العميل → OTP | Driver + Customer |
| E2E-05 | Chat بين عميل ومتجر | Customer + Store |
| E2E-06 | Admin: موافقة على حساب + رؤية إحصائيات | Admin |

---

## 4. Performance Tests

**الأداة:** Artillery  
**متى:** قبل كل major release

```yaml
# artillery-config.yml
config:
  target: "https://staging.example.com"
  phases:
    - duration: 60
      arrivalRate: 10    # 10 مستخدمين/ثانية
    - duration: 120
      arrivalRate: 50    # رamp up
    - duration: 60
      arrivalRate: 100   # peak load

scenarios:
  - name: "Browse stores and add to cart"
    flow:
      - get:
          url: "/api/public/stores"
      - get:
          url: "/api/public/stores/{{ storeId }}/products"
```

**معايير النجاح:**
```
p95 response time < 500ms
p99 response time < 2000ms
Error rate < 1%
No memory leaks (stable RSS over 30 minutes)
```

---

## 5. Security Tests

```
أدوات:
  npm audit          → dependency vulnerabilities (أسبوعياً)
  OWASP ZAP          → DAST scan (قبل كل release)
  CodeQL / Semgrep   → SAST (في CI)

يُختبَر:
  SQL Injection: محاولات حقن في كل input
  XSS: script injection في text fields
  Auth bypass: الوصول بدون token أو بدور خاطئ
  Rate limiting: تجاوز الحد المسموح
  File upload: رفع ملفات خطرة (.php, .exe)
  IDOR: الوصول لموارد مستخدمين آخرين
```

---

## 6. متى نكتب الاختبار؟

```
✅ قبل merge: Unit Tests للـ logic الجديد
✅ مع كل bug fix: Regression test يُثبت الـ fix
✅ قبل major release: Integration + Performance
✅ عند إضافة payment logic: Unit + Integration إلزامي
✅ عند تغيير state machine: Unit Tests لكل transition

❌ ما لا يحتاج unit test:
  - React components بسيطة (اختبرها بـ E2E)
  - Config files
  - Type definitions
  - console.log statements (احذفها!)
  - Single-line utility functions بدون فروع
```

---

## 7. منع Brittle Tests

```typescript
// ❌ Brittle: يعتمد على ترتيب أو قيمة محددة غير ضرورية
expect(response.body.data[0].id).toBe("abc-123"); // ❌ يتغير

// ✅ Robust: يختبر السلوك لا القيمة
expect(response.body.data).toHaveLength(1);
expect(response.body.data[0]).toMatchObject({
  status: "PENDING",
  amount: "100.00",
});

// ❌ Brittle: يعتمد على timing
await new Promise(r => setTimeout(r, 1000)); // ❌

// ✅ Robust: انتظر condition محدد
await waitFor(() => expect(screen.getByText("تم الإيداع")).toBeInTheDocument());
```

---

## القواعد الإلزامية

```
✦ TEST-01: كل PR يحتوي Unit Tests للـ business logic الجديد
✦ TEST-02: كل Bug Fix له Regression Test
✦ TEST-03: Service layer coverage ≥ 80%
✦ TEST-04: لا mock للـ DB في Integration Tests — استخدم test DB حقيقي
✦ TEST-05: Tests تعمل في isolation — لا تعتمد على ترتيب التشغيل
✦ TEST-06: لا hardcoded IDs في Tests — استخدم factories
✦ TEST-07: CI يُوقف الـ merge إذا فشلت أي Test
✦ TEST-08: Performance Tests إلزامية قبل كل major release
✦ TEST-09: npm audit أسبوعياً — لا critical vulnerabilities
✦ TEST-10: اختبر Error cases دائماً (ليس فقط Happy Path)
```
