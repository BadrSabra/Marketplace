# 13 — Documentation Rules
**قواعد التوثيق الإلزامية**

---

## المبدأ الأساسي

> **"الكود غير الموثق هو كود مجهول المصدر بعد 6 أشهر."**  
> التوثيق ليس رفاهية — هو جزء من تعريف Done.

---

## 1. متى نكتب التوثيق؟

```
✅ قبل merge: API جديدة → Swagger محدَّث
✅ قبل merge: ENV var جديد → .env.example محدَّث
✅ قبل merge: DB schema change → schema.ts وثّق الأعمدة
✅ بعد deploy: CHANGELOG.md محدَّث
✅ عند قرار تقني غير واضح → ADR (Architecture Decision Record)
✅ عند bug صعب → Postmortem في CHANGELOG
✅ عند إنشاء service جديدة → README للـ module
```

---

## 2. الوثائق الإلزامية لكل Feature جديدة

```
□ API Docs (Swagger): كل endpoint جديد
□ Type Documentation: كل type/interface معقدة
□ ENV Variables: أي متغير بيئة جديد في .env.example
□ DB Schema Comments: أعمدة غير واضحة الغرض
□ Error Codes: أي error code جديد في قاموس الأخطاء
□ Business Logic Comments: لشرح "لماذا" لا "ماذا"
```

---

## 3. الوثائق الإلزامية للمشروع (دائمة)

| الوثيقة | الموقع | المسؤول | التحديث |
|---------|--------|---------|---------|
| README.md | جذر المشروع | Lead Dev | عند كل تغيير جوهري |
| .env.example | جذر المشروع | Backend Dev | عند كل ENV var جديد |
| CHANGELOG.md | جذر المشروع | كل dev | عند كل release |
| API Docs (Swagger) | /api-docs | Backend Dev | عند كل endpoint |
| replit.md | جذر المشروع | Lead Dev | عند قرارات مهمة |
| Engineering Constitution | docs/ | Lead Dev | مراجعة دورية (3 أشهر) |

---

## 4. قواعد كتابة Swagger/OpenAPI

```typescript
// ✅ كل endpoint يحتوي على:
/**
 * @swagger
 * /api/wallet/deposit:
 *   post:
 *     summary: طلب إيداع رصيد
 *     description: يُنشئ طلب إيداع في حالة PENDING للمراجعة من الأدمن
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100000
 *                 example: 500
 *               receiptImage:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: تم إنشاء طلب الإيداع
 *       400:
 *         description: بيانات غير صالحة
 *       401:
 *         description: غير مصرح
 */
```

---

## 5. توثيق الكود

### متى تكتب JSDoc؟
```typescript
// ✅ Public Service methods — اشرح الـ business logic
/**
 * يُعالج طلب الإيداع بعد موافقة الأدمن.
 * يُضيف رصيداً للمحفظة ويُنشئ قيد Ledger ويُرسل إشعاراً.
 *
 * @throws {NotFoundError} إذا لم يُوجَد الطلب
 * @throws {Error} إذا كان الطلب ليس في حالة PENDING
 */
async approveDeposit(transactionId: string, adminId: string): Promise<void> {}

// ✅ اشرح "لماذا" لا "ماذا" في التعليقات الداخلية
// لماذا CONCURRENTLY؟ لمنع table lock في production
await db.execute(sql`CREATE INDEX CONCURRENTLY ...`);

// ✅ اشرح Edge Cases
// ملاحظة: getOrCreateWallet يُنشئ محفظة إذا لم تكن موجودة
// هذا ضروري لضمان وجود محفظة عند أول login
const wallet = await walletService.getOrCreateWallet(userId);

// ❌ لا تشرح ما هو واضح
// يجمع عددين ← لا فائدة
const total = price + tax;
```

---

## 6. ADR — Architecture Decision Records

**متى نكتب ADR؟**
```
✅ عند اختيار تقنية جديدة (Redis vs Memcached)
✅ عند تغيير pattern معماري (Modular Monolith vs Microservices)
✅ عند قرار DB (UUID vs auto-increment)
✅ عند قرار له trade-offs غير واضح الفائز فيه
```

**Template:**
```markdown
# ADR-001: استخدام UUID بدلاً من auto-increment integers

## الحالة: مقبول

## السياق
نحتاج لتحديد نوع Primary Key للجداول.

## الخيارات المدروسة
1. Auto-increment integers: بسيط، أصغر حجماً
2. UUID v4: أكبر، لكن آمن ومرن

## القرار
UUID v4 لجميع الجداول.

## المبررات
- لا يكشف عن عدد السجلات
- آمن للـ API exposure
- يدعم multi-tenant مستقبلاً
- مناسب للـ distributed systems

## العواقب
+ أمان أعلى
+ يدعم التوسع
- حجم أكبر (16 bytes vs 4 bytes)
- أصعب في الـ debugging اليدوي
```

---

## 7. CHANGELOG.md Format

```markdown
## [1.2.0] - 2026-09-15

### Added
- نظام كوبونات وخصومات (Coupons & Discounts)
- برنامج نقاط الولاء (Loyalty Points)
- تحميل الفاتورة PDF

### Changed
- تحسين أداء صفحة الطلبات (N+1 query مُصلَح)
- تحديث Drizzle ORM من 0.45 إلى 0.46

### Fixed
- إصلاح عرض الرصيد بعد إلغاء الطلب
- إصلاح عدم تحديث badge الإشعارات تلقائياً

### Security
- إضافة JWT Refresh Token mechanism
- تحسين Rate Limiting على auth endpoints

### Deprecated
- /api/orders (v1) — سيتوقف 2027-01-01، استخدم /api/v2/orders

### Removed
- حذف dead code: deposits.service.ts القديم

### Migration Notes
- شغّل: npx drizzle-kit push:pg
- أضف ENV: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
```

---

## القواعد الإلزامية

```
✦ DOC-01: لا endpoint جديد بدون Swagger
✦ DOC-02: لا ENV var جديد بدون .env.example
✦ DOC-03: لا DB column غير واضح بدون comment
✦ DOC-04: CHANGELOG.md يُحدَّث مع كل release
✦ DOC-05: القرارات التقنية الكبيرة تُوثَّق كـ ADR
✦ DOC-06: لا TODO في الكود بدون Backlog ticket رقمه
✦ DOC-07: التوثيق يُراجَع ضمن معايير الـ PR Review
✦ DOC-08: replit.md تُحدَّث بأي bug fix مهم أو قرار معماري
✦ DOC-09: الدستور الهندسي يُراجَع كل 3 أشهر
✦ DOC-10: JSDoc إلزامي على كل public Service method
```
