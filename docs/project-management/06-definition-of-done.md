# 06 — Definition of Done (DoD)
**متى تعتبر المهمة مكتملة؟**

---

## الشروط الإلزامية (يجب توفر الجميع)

### 1. الكود
- [ ] الكود مكتوب ويعمل كما هو مطلوب في Acceptance Criteria
- [ ] لا يوجد TODO أو FIXME أو console.log غير ضروري
- [ ] TypeScript types صحيحة (لا `any` بدون مبرر)
- [ ] Coding Standards محترمة (انظر وثيقة 07)
- [ ] Error handling شامل لجميع حالات الفشل

### 2. الاختبارات
- [ ] Unit Tests مكتوبة للـ service layer الجديد (coverage ≥ 80%)
- [ ] Integration Tests للـ API endpoints الجديدة
- [ ] Tests تمر محلياً: `npm test`
- [ ] لا regression في الـ tests الموجودة

### 3. المراجعة
- [ ] PR review مكتمل (≥ 1 reviewer)
- [ ] جميع تعليقات الـ review مُعالَجة أو مُبررة
- [ ] لا conflicts مع main branch

### 4. التوثيق
- [ ] API endpoints جديدة موثقة في Swagger
- [ ] تغييرات DB موثقة في schema.ts + migration file
- [ ] README محدّث إن تغيرت طريقة التشغيل

### 5. الأمان
- [ ] Input validation بـ Zod لجميع المدخلات
- [ ] Authorization middleware موجود على كل protected route
- [ ] لا secrets مكتوبة في الكود
- [ ] لا SQL injection ممكن

### 6. الأداء
- [ ] لا N+1 queries جديدة بدون مبرر
- [ ] Pagination موجود في كل endpoint يُعيد قوائم

### 7. النشر
- [ ] يعمل في Staging Environment
- [ ] لا تغييرات breaking للـ API بدون version bump
- [ ] Environment variables جديدة موثقة

---

## مستويات DoD حسب نوع المهمة

### Bug Fix
```
✅ الكود + Unit Test + PR review + Staging verification
```

### New Feature
```
✅ كل ما سبق + Integration Tests + API Docs + User Guide update
```

### DB Migration
```
✅ كل ما سبق + Rollback script + tested on Staging DB أولاً
```

### Security Fix
```
✅ كل ما سبق + Security review + Penetration test للميزة
```

### Performance Fix
```
✅ الكود + before/after metrics + Load test تأكيد
```
