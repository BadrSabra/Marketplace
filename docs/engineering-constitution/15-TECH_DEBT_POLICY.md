# 15 — Tech Debt Policy
**سياسة الديون التقنية**

---

## التعريف

**Technical Debt** هي أي قرار تقني يُسرّع التسليم اليوم لكنه يزيد تكلفة الصيانة مستقبلاً.

الدين التقني ليس سيئاً دائماً — **الدين المتعمد والموثق مقبول، الدين الخفي هو الخطر.**

```
أنواع الدين:

🟢 مقبول (Intentional Debt):
  "أكتب uploads/ محلياً الآن وأنتقل لـ S3 في Sprint 1"
  موثق + مخطط + له موعد

🟡 محتمل (Inadvertent Debt):
  "لم أعرف وقتها أن هذا هو الأفضل"
  يُسجَّل فور الاكتشاف

🔴 خطير (Reckless Debt):
  "لا وقت للاختبارات الآن"
  يُرفض في Code Review
```

---

## 1. كيف نُعرِّف الدين التقني؟

دين تقني هو:
- كود يعمل لكن يحتاج إعادة كتابة لأسباب بنيوية
- اختصار مؤقت أُريد له أن يُصبح دائماً
- كود بدون tests يُغطيه
- documentation ناقصة لكود حرج
- تبعية قديمة لم تُحدَّث منذ مدة
- pattern يتعارض مع الدستور الهندسي
- معالجة جزئية لمشكلة (workaround لا fix)

---

## 2. كيف نُسجّل الدين؟

### في الكود (TODO comment موثق)
```typescript
// TODO[TECH-DEBT-012]: تحويل local uploads لـ AWS S3
// السبب: uploads/ تُفقد عند إعادة تشغيل الخادم
// الأثر: عالٍ — يؤثر على صور المنتجات والمتاجر
// الجهد: M (3-4 أيام)
// المخطط: Sprint 1
const uploadPath = path.join("uploads", filename);
```

### في Technical Debt Register (وثيقة 12 من Project Management)
```markdown
| ID       | الوصف | السبب | الأثر | الجهد | Sprint |
|----------|-------|-------|-------|-------|--------|
| DEBT-001 | Local file storage | time constraint | عالٍ | M | Sprint 1 |
| DEBT-002 | routes.ts أحادي ضخم | monolith start | متوسط | M | Sprint 2 |
```

---

## 3. التصنيف

| الفئة | التعريف | الإجراء |
|-------|---------|---------|
| 🔴 Critical | يمنع التوسع أو يُسبب bugs حالية | يُعالَج في Sprint الحالي |
| 🟠 High | يبطئ التطوير بشكل ملموس | يُخطط لـ Sprint قريب |
| 🟡 Medium | مشكلة بنيوية لا تؤثر اليوم | يُدرج في Backlog |
| 🟢 Low | تحسين جمالي أو أداء طفيف | يُعالَج عند التمرير (Opportunistic) |

---

## 4. متى يُعالَج الدين؟

```
🔴 Critical: يُدرج في Sprint الحالي كـ High Priority Story
🟠 High:     يُعالَج خلال Sprint 1-2 القادمين
🟡 Medium:   يُعالَج في Sprints منتصف المشروع
🟢 Low:      يُعالَج عند لمس الكود ذي الصلة (Boy Scout Rule)

Boy Scout Rule:
"دائماً اترك الكود أنظف مما وجدته."
إذا مررت بـ function فيها code smell → أصلحه حتى لو لم يكن مهمتك.
```

---

## 5. متى يُقبَل الدين مؤقتاً؟

```
✅ مقبول بشروط:
  1. موثق بـ TODO comment يشرح السبب
  2. مسجّل في Debt Register
  3. له موعد تقريبي للمعالجة
  4. لا يُسبب security risk أو data loss
  5. موافقة Lead Engineer

✅ أمثلة مقبولة:
  "uploads/ محلي → S3 في Sprint 1" (موثق، مخطط)
  "بدون Unit Tests → تُضاف في Sprint 2" (مؤقت)
  "mock email بـ console.log → Nodemailer في Sprint 3" (واضح)

❌ غير مقبول حتى مؤقتاً:
  أي كود فيه security vulnerability
  أي كود يمكنه فقدان بيانات مالية
  أي Auth bypass "مؤقت"
```

---

## 6. منع تراكم الدين

```
Sprints:
  10% من capacity كل Sprint مخصص لمعالجة Debt
  (8 ساعات من كل 80 ساعة Sprint)

Metrics:
  Debt Ratio = (Debt Items) / (Total Stories)
  هدف: Debt Ratio < 20%

Review:
  في Sprint Retrospective: راجع الـ Debt Register
  هل تراكم شيء جديد؟
  هل يُؤجَّل شيء كثيراً؟
```

---

## 7. الديون الموجودة حالياً (أولوية المعالجة)

| المرتبة | ID | الدين | الأثر | Sprint |
|---------|-----|------|-------|--------|
| 1 | DEBT-001 | Local uploads → S3 | 🔴 Critical | Sprint 1 |
| 2 | DEBT-002 | JWT بدون Blacklist | 🔴 Critical | Sprint 1 |
| 3 | DEBT-003 | routes.ts ضخم (>1500 سطر) | 🟠 High | Sprint 2 |
| 4 | DEBT-004 | بدون Unit Tests | 🟠 High | Sprint 1-2 |
| 5 | DEBT-005 | بدون Swagger Docs | 🟠 High | Sprint 2 |
| 6 | DEBT-006 | بدون Redis Cache | 🟡 Medium | Sprint 4 |
| 7 | DEBT-007 | Payment manual (لا Stripe) | 🔴 Critical | Sprint 3 |
| 8 | DEBT-008 | بدون DB Indexes الإضافية | 🟡 Medium | Sprint 4 |

---

## 8. من المسؤول؟

```
كل مطوّر: مسؤول عن توثيق الدين الذي يُنشئه
Lead Dev:   مسؤول عن Debt Register والأولويات
Sprints:    مسؤولية جماعية لتخصيص 10% للـ Debt
المراجع:   يُوقف merge إذا تراكم دين جديد بدون توثيق
```

---

## القواعد الإلزامية

```
✦ TD-01: لا دين جديد بدون TODO comment موثق في الكود
✦ TD-02: لا دين جديد بدون إدراجه في Debt Register
✦ TD-03: كل sprint يخصص 10% للـ Debt العلاجي
✦ TD-04: الدين الأمني (Auth/Security) لا يُؤجَّل
✦ TD-05: الدين المالي (wallet, ledger) لا يُؤجَّل
✦ TD-06: Debt Ratio > 25% → Sprint Debt يُخصص 20% بدلاً من 10%
✦ TD-07: Boy Scout Rule: اترك الكود أنظف مما وجدته
✦ TD-08: Code Review يرفض دين جديد بدون توثيق
```
