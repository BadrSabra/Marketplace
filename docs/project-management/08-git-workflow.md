# 08 — Git Workflow
**سياسة Git الكاملة للمشروع**

---

## 1. Branching Strategy

### الفروع الدائمة
```
main       → الإنتاج (production-ready دائماً)
develop    → التكامل (integration branch)
```

### الفروع المؤقتة
```
feature/<ticket-id>-<short-description>   مثال: feature/PM-042-stripe-integration
fix/<ticket-id>-<short-description>       مثال: fix/PM-089-wallet-race-condition
hotfix/<ticket-id>-<short-description>    مثال: hotfix/PM-101-otp-expiry-bug
release/<version>                          مثال: release/1.1.0
chore/<description>                        مثال: chore/update-dependencies
refactor/<description>                     مثال: refactor/split-routes-file
docs/<description>                         مثال: docs/swagger-api
```

### قواعد الفروع
```
✅ Feature branches تُنشأ من: develop
✅ Release branches تُنشأ من: develop
✅ Hotfix branches تُنشأ من: main (للإصلاحات العاجلة)
✅ تُدمج Hotfix إلى: main + develop
❌ لا push مباشر إلى main أبداً
❌ لا push مباشر إلى develop بدون PR
```

---

## 2. Commit Convention (Conventional Commits)

### الصيغة
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### أنواع الـ Commits
```
feat      → ميزة جديدة
fix       → إصلاح bug
refactor  → إعادة هيكلة بدون تغيير وظيفي
perf      → تحسين أداء
test      → إضافة/تعديل tests
docs      → توثيق فقط
chore     → مهام صيانة (dependencies, config)
style     → تنسيق كود (spaces, commas) بدون تغيير منطقي
ci        → تغييرات CI/CD
security  → إصلاح ثغرة أمنية
```

### أمثلة صحيحة
```
feat(wallet): add Stripe payment gateway integration
fix(auth): resolve JWT token not expiring on logout
refactor(routes): split routes.ts into feature-based routers
perf(orders): add Redis caching for stores list
test(wallet): add unit tests for approveDeposit service
docs(api): add Swagger documentation for wallet endpoints
security(auth): implement JWT refresh token mechanism
chore(deps): update drizzle-orm to 0.46.0
```

### أمثلة خاطئة
```
❌ "fix bug"                    — غير وصفي
❌ "WIP"                        — لا تعمل في نهاية اليوم
❌ "feat: add login and register and wallet and orders" — commit ضخم
❌ "update"                     — لا معنى
```

### Breaking Changes
```
feat(api)!: change wallet response format to include currency

BREAKING CHANGE: `balance` field now includes currency code.
Old: { balance: "100.00" }
New: { balance: { amount: "100.00", currency: "EGP" } }

Migration: update all frontend wallet consumers to use balance.amount
```

---

## 3. Pull Request Rules

### شروط فتح PR
- [ ] عنوان PR يتبع Conventional Commits
- [ ] Description تشمل: ماذا + لماذا + كيف الاختبار
- [ ] Checklist من الـ PR Template مكتملة
- [ ] لا conflicts مع target branch
- [ ] Tests تمر على CI

### PR Template
```markdown
## Summary
<!-- ماذا يفعل هذا PR؟ -->

## Why
<!-- لماذا هذا التغيير ضروري؟ -->

## How to Test
<!-- خطوات اختبار التغيير يدوياً -->

## Checklist
- [ ] Tests مكتوبة وتمر
- [ ] TypeScript بدون errors
- [ ] لا console.log في الكود
- [ ] API docs محدثة (إن وجد endpoint جديد)
- [ ] لا secrets في الكود
- [ ] Tested on Staging

## Screenshots (إن كانت UI changes)
```

### قواعد المراجعة
```
- يلزم reviewer واحد على الأقل
- المراجع يُوافق أو يطلب تغييرات (لا اقتراحات اختيارية إلزامية)
- لا يُمكن للـ author merge PR نفسه إلا في حالات الـ hotfix العاجلة
- تعليقات المراجعة تُعالَج قبل الـ merge
- PR يجب أن يكون focused — ميزة واحدة أو إصلاح واحد
```

---

## 4. Merge Rules

```
feature/* → develop    : Squash Merge (commits تُجمع في commit واحد)
release/* → main       : Regular Merge + Tag
hotfix/*  → main       : Regular Merge + Tag
hotfix/*  → develop    : Cherry-pick أو Regular Merge
```

### منع الـ Force Push
```
main    → ❌ Force push ممنوع تماماً
develop → ❌ Force push ممنوع
feature → ✅ Force push مسموح (قبل فتح PR)
```

---

## 5. Release Strategy

### إطلاق نسخة جديدة
```bash
# 1. إنشاء release branch
git checkout develop
git checkout -b release/1.1.0

# 2. تحديث version في package.json
npm version minor  # أو major أو patch

# 3. اختبار في Staging
# 4. إذا وُجدت bugs → fix مباشرة في release branch

# 5. Merge إلى main
git checkout main
git merge --no-ff release/1.1.0
git tag -a v1.1.0 -m "Release 1.1.0: Maps + PWA + Coupons"

# 6. Merge back إلى develop
git checkout develop
git merge --no-ff release/1.1.0

# 7. حذف release branch
git branch -d release/1.1.0
```

---

## 6. Hotfix Process

للـ bugs الحرجة في Production فقط:

```bash
# 1. من main مباشرة
git checkout main
git checkout -b hotfix/PM-101-payment-crash

# 2. الإصلاح + test
# 3. PR للـ hotfix (مراجعة سريعة، reviewer واحد يكفي)

# 4. Merge إلى main
git checkout main
git merge --no-ff hotfix/PM-101-payment-crash
git tag -a v1.0.1 -m "Hotfix: payment crash on zero balance"

# 5. Merge إلى develop
git checkout develop
git merge --no-ff hotfix/PM-101-payment-crash

# 6. Deploy فوري إلى Production
```

---

## 7. Rollback Plan

```bash
# الحالة 1: Rollback آخر deployment (الأسهل)
git checkout main
git revert HEAD  # أو revert الـ merge commit
git push origin main
# → CI/CD تنشر تلقائياً

# الحالة 2: Rollback إلى tag معين
git checkout v1.0.2  # النسخة السليمة
git checkout -b hotfix/emergency-rollback
# → نشر الـ hotfix

# الحالة 3: DB Migration rollback
# كل migration لها rollback script جاهز مسبقاً
# انظر docs/project-management/20-deployment-plan.md
```
