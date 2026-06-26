# 04 — Development Workflow
**دورة العمل الكاملة من الفكرة للإنتاج**

---

## نظرة عامة

```
┌─────────────────────────────────────────────────────────────┐
│                   DEVELOPMENT CYCLE                          │
│                                                              │
│  Analysis → Design → Implementation → Review → Testing      │
│                                    ↓                         │
│  Deployment ← Monitoring ← Documentation ← Merge            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Analysis (التحليل)

### المدخلات
- User Story من Backlog (وثيقة 02)
- Acceptance Criteria محددة
- الأولوية والحجم المُقدَّر

### الخطوات

**1.1 فهم المتطلبات**
```
اقرأ الـ Story كاملاً مع Acceptance Criteria
اطرح أسئلة إن كان هناك غموض قبل البدء:
  - ماذا يحدث في حالة X؟
  - هل هناك Edge Cases؟
  - هل تؤثر على ميزة Y الموجودة؟
```

**1.2 تحليل الأثر (Impact Analysis)**
```markdown
## تحليل أثر المهمة: [اسم المهمة]

### الملفات التي ستتغير
- server/modules/wallet/wallet.service.ts  (تعديل: approveDeposit)
- server/modules/wallet/wallet.router.ts   (لا تغيير)
- shared/schema.ts                          (لا تغيير)
- client/src/pages/customer/wallet.tsx     (إضافة زر جديد)

### تغييرات DB
- لا تغييرات في Schema
  أو:
- إضافة عمود: ALTER TABLE orders ADD COLUMN coupon_id UUID REFERENCES coupons(id)

### API Changes
- PATCH /api/wallet/deposit/:id/approve
  Response لا يتغير (backward compatible)

### تأثير على الميزات الأخرى
- تأثير على Ledger: نعم (ledger entry يُضاف)
- تأثير على Notifications: نعم (APPROVED notification يُرسل)
- تأثير على Audit Log: نعم (تُسجَّل العملية)

### هل هو Backward Compatible؟
✅ نعم — لا تغيير في الـ API interface
```

**1.3 التحقق من الـ DoR**
```
✅ راجع Definition of Ready (05-definition-of-ready.md)
✅ تأكد من جاهزية المهمة قبل البدء
```

---

## 2. Design (التصميم)

### 2.1 DB Design (إذا كانت هناك تغييرات)
```typescript
// في shared/schema.ts
export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(), // PERCENTAGE | FIXED
  discountValue: numeric("discount_value").notNull(),
  minOrderAmount: numeric("min_order_amount"),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert Schema
export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  usedCount: true,
  createdAt: true,
});
```

### 2.2 API Design
```
قبل كتابة الكود، حدد:

Endpoint:   POST /api/admin/coupons
Auth:       ADMIN role
Request:    { code, discountType, discountValue, minOrderAmount?, maxUses?, expiresAt? }
Response:   { success: true, data: { id, code, ... } }
Errors:
  400: Zod validation fails
  409: code already exists
  401: not authenticated
  403: not ADMIN
```

### 2.3 Service Design
```typescript
// نموذج تصميم الـ method قبل التنفيذ
interface CouponService {
  createCoupon(data: InsertCoupon, adminId: string): Promise<Coupon>;
  validateCoupon(code: string, orderAmount: number): Promise<CouponValidationResult>;
  applyCoupon(code: string, orderId: string): Promise<DiscountedOrder>;
  getActiveCoupons(): Promise<Coupon[]>;
}
```

### 2.4 UI Design (إذا كانت واجهة)
```
- Wireframe أو نص وصفي لتصميم الـ Component
- أي Props تحتاجها
- State management (TanStack Query)
- Error states + Loading states
```

---

## 3. Implementation (التنفيذ)

### ترتيب الكتابة (دائماً من الداخل للخارج)
```
1. Schema (shared/schema.ts) — إن وجد تغيير DB
2. Migration (drizzle-kit push أو generate)
3. Storage (server/storage.ts أو module storage file)
4. Service (business logic)
5. Controller (HTTP layer)
6. Router (route registration)
7. Frontend Hook (useQuery/useMutation)
8. Frontend Component (UI)
```

### قواعد أثناء التنفيذ
```
✅ commit صغير كل مهمة منطقية مكتملة
✅ لا تتجاوز 200 سطر في commit واحد (إلا في حالات استثنائية)
✅ لا console.log — استخدم log() أو auditService.insertAuditLog()
✅ TypeScript strict — لا any بدون مبرر
✅ Zod validation على كل request body
✅ Authentication + Authorization على كل protected route
```

### مثال تطبيقي متكامل
```typescript
// 1. Schema ✅ (shared/schema.ts)
// 2. Storage ✅ (IStorage + implementation)
// 3. Service ✅
export class CouponService {
  async validateCoupon(code: string, orderAmount: number) {
    const coupon = await storage.getCouponByCode(code);
    if (!coupon) throw new Error("COUPON_NOT_FOUND");
    if (coupon.expiresAt && new Date() > coupon.expiresAt)
      throw new Error("COUPON_EXPIRED");
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
      throw new Error("COUPON_EXHAUSTED");
    if (coupon.minOrderAmount && orderAmount < Number(coupon.minOrderAmount))
      throw new Error("ORDER_BELOW_MINIMUM");
    return coupon;
  }
}

// 4. Controller ✅
export const applyCoupon = async (req, res, next) => {
  try {
    const { code } = req.body;
    const result = await couponService.validateCoupon(code, req.body.orderAmount);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
```

---

## 4. Review (المراجعة)

### Self-Review (قبل فتح PR)
```
□ الكود يحقق الـ Acceptance Criteria بالكامل
□ لا console.log
□ لا any غير مبرر
□ Error handling شامل
□ Tests مكتوبة وتمر
□ لا secrets في الكود
□ API documented في Swagger (إن وجد endpoint جديد)
□ لا breaking changes بدون توثيق
□ TypeScript لا يُظهر errors
□ تشغيل محلي ناجح
```

### فتح PR
```
git checkout -b feature/PM-046-coupons-system
git add .
git commit -m "feat(coupons): implement coupon validation and discount system"
git push origin feature/PM-046-coupons-system
# ثم فتح PR على GitHub/GitLab مع PR Template
```

### Peer Review
```
المراجع يتحقق من:
  - المنطق صحيح (لا bugs واضحة)
  - الأمان (لا ثغرات)
  - الكفاءة (لا N+1، لا استعلامات غير ضرورية)
  - القابلية للصيانة (Clean Code)
  - اكتمال الـ Tests

المراجع يُعلّق بـ:
  ✅ Approved (جاهز للـ merge)
  💬 Comment (اقتراح، لا يمنع الـ merge)
  ❌ Request Changes (يجب إصلاحه قبل الـ merge)
```

---

## 5. Testing (الاختبار)

### ترتيب الاختبار
```
1. Unit Tests: npm test (يجب أن تمر أولاً)
2. Integration Tests: npm run test:integration
3. Manual Testing (الخطوات موثقة في PR)
4. Staging Environment verification
```

### Manual Testing Checklist (لكل مهمة)
```
□ الـ Happy Path: الحالة الطبيعية تعمل
□ Edge Cases: قيم حدودية (0، null، string طويل)
□ Error Cases: مدخلات خاطئة تُعيد error واضح
□ Auth Cases: بدون token يُعيد 401، دور خاطئ يُعيد 403
□ Mobile: الصفحة تعمل على شاشة 375px
□ RTL: النص العربي يظهر صحيحاً
```

---

## 6. Merge (الدمج)

### شروط الـ Merge
```
✅ CI يمر (lint + typecheck + unit tests)
✅ Review مكتمل (Approved)
✅ لا conflicts مع develop
✅ Staging tests تمر
```

### عملية الـ Merge
```bash
# تحديث branch بآخر develop
git checkout feature/PM-046-coupons-system
git rebase origin/develop

# Push والـ PR يُحدَّث تلقائياً
git push origin feature/PM-046-coupons-system --force-with-lease

# Merge (Squash) من GitHub/GitLab UI
# → جميع commits في feature branch تُدمج في commit واحد نظيف
```

---

## 7. Deployment (النشر)

### بيئة Staging (تلقائي)
```
merge إلى develop → CI يبدأ تلقائياً:
  1. npm test
  2. npm run build
  3. Deploy إلى Staging
  4. Health check: GET /api/health
  5. إشعار Slack: "Staging updated ✅"
```

### بيئة Production (يدوي)
```
1. Sprint Review: Stakeholders يُوافقون على الـ Sprint
2. Release branch يُنشأ من develop
3. Testing أخير في Staging
4. PR: release/* → main
5. Merge بعد موافقة Lead Developer
6. Git Tag: git tag -a v1.x.x
7. Deploy إلى Production
8. Health check خلال 5 دقائق
9. Monitor Error Rate خلال 30 دقيقة
10. إشعار Slack: "v1.x.x deployed to Production ✅"
```

---

## 8. Monitoring (المراقبة)

### بعد كل Deployment
```
أول 30 دقيقة:
  □ Error rate < 1% (Sentry)
  □ API response time < 300ms average
  □ لا DB errors في Logs
  □ Health check يمر

أول 24 ساعة:
  □ لا spike في الأخطاء
  □ Memory stable
  □ لا user complaints
```

### إذا وُجد مشكلة بعد Deployment
```
مشكلة طفيفة (warning فقط):
  → Hotfix branch → fix → deploy

مشكلة متوسطة (بعض المستخدمين متأثرون):
  → Rollback فوري → تحليل → إصلاح

مشكلة حرجة (النظام لا يعمل):
  → Rollback فوري
  → إشعار العملاء
  → Incident Report
  → Post-mortem خلال 48 ساعة
```

---

## 9. Documentation (التوثيق)

### ما يُوثَّق بعد كل مهمة
```
□ API endpoint جديد → Swagger محدَّث
□ ENV variable جديد → .env.example محدَّث
□ DB table/column جديد → schema.ts موثَّق
□ قرار تقني مهم → .agents/memory/ محدَّث
□ Bug خاص بالبيئة → replit.md أو MEMORY.md
□ غيّرت طريقة تشغيل → README محدَّث
```

### CHANGELOG.md
```markdown
## [1.1.0] - 2026-07-15

### Added
- Coupons & Discount Codes system
- Loyalty Points program
- PDF Invoice download

### Fixed
- Wallet balance not updating after order cancellation

### Security
- Added JWT Refresh Token mechanism
```

---

## Workflow Summary

```
User Story
    ↓
Analysis (Impact + Risk)
    ↓
Design (Schema → API → UI)
    ↓
feature/xxx branch
    ↓
Implementation (Schema → Service → Controller → Frontend)
    ↓
Self-Review Checklist
    ↓
Unit Tests تمر
    ↓
PR فتح
    ↓
Peer Review
    ↓
Integration Tests تمر
    ↓
Staging Deployment
    ↓
Manual Verification
    ↓
Merge إلى develop
    ↓
[Sprint end] → Production Deployment
    ↓
Monitoring (30 min)
    ↓
Documentation Update
    ↓
✅ Done (DoD محقق)
```
