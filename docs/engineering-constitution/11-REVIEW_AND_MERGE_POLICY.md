# 11 — Review & Merge Policy
**سياسة المراجعة والدمج الإلزامية**

---

## مبدأ أساسي

> **أي تعديل يمس Architecture, Database, Security, Billing, أو Auth يجب أن يُراجَع بعناية فائقة قبل الدمج.**

هذه المناطق الخمس مناطق حرجة — خطأ فيها يؤثر على المال أو البيانات أو الأمان.

---

## 1. Branch Strategy

```
main          ← production فقط (protected)
develop       ← integration branch (protected)
feature/xxx   ← كل مهمة في branch خاص
hotfix/xxx    ← إصلاحات عاجلة (من main مباشرة)
release/x.x.x ← إعداد الإصدار (من develop)
```

**قاعدة:**
- لا أحد يـ commit مباشرة على `main` أو `develop`
- كل تعديل عبر PR
- الاستثناء الوحيد: Lead Engineer في حالات hotfix حرجة

---

## 2. PR Requirements (ما الذي يجب مراجعته قبل الدمج)

### Checklist إلزامي لـ فاتح الـ PR
```
□ الكود يحقق الـ Acceptance Criteria بالكامل
□ Self-review مكتمل (راجع الكود وكأنك مراجع آخر)
□ Unit Tests مكتوبة وتمر: npm test ✅
□ TypeScript: لا errors: npx tsc --noEmit ✅
□ Lint: لا warnings حرجة
□ لا console.log في الكود
□ لا any بدون تعليق يبرره
□ لا hardcoded secrets
□ API جديدة موثقة في Swagger
□ ENV vars جديدة في .env.example
□ DB changes لها migration + rollback
□ PR Description يشرح: ماذا، لماذا، كيف الاختبار
□ تحديد نوع التغيير: Feature / Bug Fix / Refactor / Security / Performance
```

---

## 3. ما الذي يمنع الدمج (Blocking)

```
🔴 BLOCKING — لا يُدمَج حتى يُحَل:
  ❌ Unit Tests تفشل
  ❌ TypeScript errors
  ❌ وجود secret في الكود
  ❌ SQL injection vulnerability
  ❌ Authentication/Authorization مكسورة
  ❌ DB migration بدون rollback script
  ❌ Breaking change في API بدون versioning
  ❌ Business logic في Controller أو React component
  ❌ Direct DB query خارج Storage layer
  ❌ wallet.service.ts تغيير بدون unit tests

🟠 MAJOR — يُصلَح قبل الدمج (بموافقة مراجع):
  ⚠ Coverage انخفض عن 80% في ملفات مُعدَّلة
  ⚠ Function أطول من 40 سطر بدون مبرر
  ⚠ DRY violation (نفس الكود في مكانين)
  ⚠ لا pagination لـ endpoint يُعيد قائمة

🟡 MINOR — تعليق، لا يمنع الدمج:
  💬 اقتراح تحسين readability
  💬 اقتراح اسم أفضل
  💬 تعليق على style
```

---

## 4. تقييم المخاطر

| مستوى الخطر | المنطقة | المراجع المطلوب | وقت المراجعة |
|------------|---------|----------------|--------------|
| 🔴 Critical | Auth, Payments, Security, DB Schema | Lead Engineer | 2-4 ساعات |
| 🟠 High | Wallet, Orders, Delivery | Senior Dev + 1 مراجع | 1-2 ساعة |
| 🟡 Medium | API جديدة، Features | 1 مراجع | 30-60 دقيقة |
| 🟢 Low | UI فقط، Docs، Typos | Self-review كافٍ | 15 دقيقة |

---

## 5. فحص أثر التعديلات (Impact Check)

**يجب على المراجع الفحص:**

```markdown
## Impact Check Template

### Core Changes
- [ ] wallet.service.ts / ledger.service.ts — مسّها؟
- [ ] shared/schema.ts — تغيير في DB?
- [ ] authenticate.ts / authorize.ts — تغيير في Auth?
- [ ] إضافة route جديدة؟

### Side Effects
- [ ] هل يؤثر على ميزة أخرى؟
- [ ] هل يغير behavior موجود؟
- [ ] هل يكسر backward compatibility؟

### Performance
- [ ] N+1 query جديد؟
- [ ] Endpoint بدون pagination؟
- [ ] Loop على DB queries؟

### Security
- [ ] Input validation موجود؟
- [ ] Authorization صحيح؟
- [ ] لا data leakage في response؟
```

---

## 6. متى يُسمح بالدمج المباشر (Bypass)؟

```
يُسمح لـ Lead Engineer فقط في حالات:
  ✅ إصلاح critical bug يمنع users من الدخول
  ✅ Security patch لـ zero-day vulnerability
  ✅ Rollback لـ breaking deployment

الشرط الإلزامي حتى في هذه الحالات:
  1. توثيق السبب في commit message
  2. إنشاء PR للمراجعة اللاحقة خلال 24 ساعة
  3. اختبار على Staging أولاً (حتى لو سريع)
```

---

## 7. سياسة Hotfix

```
1. أنشئ hotfix/critical-fix-description من main
2. أصلح الـ bug (أقل قدر ممكن من التغييرات)
3. اختبر محلياً + Staging
4. PR إلى main (مراجعة مسرّعة — 15-30 دقيقة)
5. بعد merge لـ main: tag v1.x.x+1
6. Deploy فوراً
7. Cherry-pick أو merge main → develop لمزامنة الإصلاح
8. Post-mortem في CHANGELOG.md
```

---

## 8. Rollback Policy

```
متى نـ Rollback؟
  - Error rate > 5% بعد deployment
  - Critical endpoint لا يستجيب
  - Data corruption مشتبه به
  - Payment processing فاشل

كيف؟
  Option A (Fast): Revert git commit + redeploy (< 10 دقائق)
  Option B (DB): DB rollback migration إذا لزم (أبطأ — 30 دقيقة)

من يقرر؟
  Lead Engineer أو من يعمل on-call
  لا تنتظر موافقة جماعية — القرار سريع
```

---

## القواعد الإلزامية

```
✦ REV-01: كل PR يمر بـ checklist إلزامي قبل فتحه
✦ REV-02: لا merge بدون Unit Tests تمر
✦ REV-03: لا merge بدون TypeScript clean
✦ REV-04: التغييرات الحرجة (Auth/DB/Security/Payments) → Lead Engineer Review
✦ REV-05: لا commits مباشرة على main أو develop (إلا hotfix lead)
✦ REV-06: كل PR له Impact Check مكتمل
✦ REV-07: Staging deployment إلزامي قبل Production
✦ REV-08: Hotfix لها Post-mortem في CHANGELOG.md
✦ REV-09: Rollback plan موثق قبل كل major release
✦ REV-10: لا تراجع "لن يحدث شيء" — كل تغيير يُحتمل أثره
```
