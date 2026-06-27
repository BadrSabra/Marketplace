# 16 — AI Agent Rules
**القواعد الإلزامية لوكلاء الذكاء الاصطناعي**

---

## ⚠ تحذير مهم

هذه الوثيقة **إلزامية ومُلزِمة** لكل وكيل ذكاء اصطناعي يعمل على هذا المشروع.  
**انحراف عن هذه القواعد = خطأ محتمل في بيانات أو أموال أو أمان.**

---

## 0. قبل أي شيء — اقرأ هذا

```
أنت تعمل على منصة تجارية حقيقية تتعامل مع:
  ✦ أموال مستخدمين حقيقيين (wallet, ledger, payments)
  ✦ بيانات شخصية (أسماء، أرقام هواتف، عناوين)
  ✦ بيانات تجارية (طلبات، منتجات، متاجر)

خطأ في wallet.service.ts يمكن أن يُفقد مستخدماً رصيده.
خطأ في auth يمكن أن يُعرِّض حسابات للاختراق.
خطأ في DB migration يمكن أن يُفسد بيانات لا تُسترجع.

افعل بحذر. اسأل إذا شككت. وثّق كل ما تغيره.
```

---

## 1. قبل أي تعديل — القراءة الإلزامية

```
أولاً: اقرأ هذه الوثائق قبل كتابة أي كود:
  [ ] docs/engineering-constitution/01-INTRODUCTION.md
  [ ] docs/engineering-constitution/02-ARCHITECTURE_PRINCIPLES.md
  [ ] docs/engineering-constitution/08-DATABASE_CONSTITUTION.md (إذا مسّ DB)
  [ ] docs/engineering-constitution/09-SECURITY_PRINCIPLES.md (إذا مسّ Auth/Security)
  [ ] replit.md → فهم القرارات السابقة والـ Fixes المطبقة
  [ ] docs/PRD-and-roadmap.md → فهم الهدف التجاري

ثانياً: حدد الحالة الحالية:
  [ ] ما الملفات المتأثرة؟
  [ ] هل يوجد كود موجود يفعل شيئاً مشابهاً؟
  [ ] ما الـ Tests الموجودة للملفات التي ستمسها؟
  [ ] هل هناك TODO أو DEBT comment في المنطقة؟

ثالثاً: افهم المهمة:
  [ ] ما الـ Acceptance Criteria بالضبط؟
  [ ] ما هي حالات الفشل (Error Cases)؟
  [ ] هل هناك أثر على ميزات أخرى؟
```

---

## 2. قواعد "لا تفعل" المطلقة

```
🚫 لا تعيد بناء المشروع من الصفر
   المشروع يحتوي منطق تجاري وقرارات مدروسة.
   إعادة البناء = فقدان هذا الإرث.

🚫 لا تكسر الأشياء العاملة
   قبل أي تعديل: تأكد أن tests تمر.
   بعد أي تعديل: تأكد أن tests لا تزال تمر.

🚫 لا تفترض معلومات غير موجودة في الكود أو الوثائق
   إذا لم تجد معلومة → اسأل المستخدم، لا تخمن.

🚫 لا تُدخِل تغييرات كبيرة دون تحليل أثر
   أي تغيير يمس > 5 ملفات → توقف واشرح الخطة أولاً.

🚫 لا تتجاهل الاختبارات
   لا تكتب "الاختبارات تُضاف لاحقاً" إلا بموافقة صريحة.

🚫 لا تتجاهل التوثيق
   كل endpoint جديد → Swagger.
   كل ENV var جديد → .env.example.

🚫 لا تتجاوز حدود المجلدات والمسؤوليات
   راجع: 04-FILE_AND_FOLDER_STRUCTURE.md دائماً.

🚫 لا تُعدِّل ملفات Config الحساسة بدون إشارة
   drizzle.config.ts, vite.config.ts, server/vite.ts
   → لا تُعدَّل إلا بموافقة صريحة من المستخدم.

🚫 لا تحذف كوداً دون التحقق أنه غير مستخدَم
   استخدم grep للبحث عن الاستخدامات أولاً.

🚫 لا تضع secrets في الكود
   ENV vars دائماً. راجع: 09-SECURITY_PRINCIPLES.md.
```

---

## 3. قواعد "افعل دائماً"

```
✅ ابدأ بقراءة الملفات قبل تعديلها
   لا تكتب كوداً دون قراءة الكود الموجود أولاً.

✅ افحص الـ imports قبل إضافة dependency جديدة
   هل الـ library موجودة بالفعل؟ هل هناك utility مشابهة؟

✅ تبع نفس patterns الموجودة
   المشروع له أسلوب كتابة موحد. تبعه لا تخترعه.

✅ اكتب Unit Tests للـ business logic الجديد
   بالأخص: wallet، orders، delivery، auth.

✅ تحقق من Drizzle schema قبل أي DB change
   shared/schema.ts هو المصدر الوحيد للحقيقة.

✅ استخدم db.transaction() لأي عملية تمس أكثر من جدول
   خاصة أي عملية مالية.

✅ أضف audit log للعمليات الحساسة
   راجع: 09-SECURITY_PRINCIPLES.md القسم 9.

✅ تحقق من Route ordering في App.tsx
   (درس مستفاد: /store/dashboard يجب أن يسبق /store/:id)

✅ تحقق من UUID validation قبل DB queries
   validateUUID() في كل :id param.
```

---

## 4. التمييز: متى تبدأ فوراً؟ متى تطلب موافقة؟

### ابدأ فوراً (Low Risk)
```
✅ إضافة UI component جديد
✅ إضافة ترجمة عربية في ar.ts
✅ إصلاح typo في نص أو رسالة
✅ تحسين error message
✅ إضافة data-testid
✅ تحديث .env.example
✅ كتابة Tests جديدة بدون تغيير الكود
✅ تحديث Swagger documentation
✅ إضافة index للـ DB (مع تحليل الأثر)
```

### اشرح الخطة أولاً (Medium Risk)
```
⚠ إضافة route جديدة
⚠ إضافة service جديدة
⚠ تغيير response format لـ API موجودة
⚠ إضافة middleware
⚠ إضافة ENV var جديد
⚠ تغيير في shared/schema.ts (بدون migration)
```

### اطلب موافقة صريحة (High Risk)
```
🔴 أي تغيير في wallet.service.ts أو ledger.service.ts
🔴 أي تغيير في authenticate.ts أو authorize.ts
🔴 أي DB migration تمس جداول موجودة
🔴 أي تغيير في JWT logic
🔴 حذف ملف أو كود موجود
🔴 إضافة payment provider أو تغييره
🔴 أي breaking change في API
🔴 أي تغيير في socket.io event names أو format
🔴 تغيير في DB connection أو pool settings
🔴 refactor يمس > 5 ملفات
```

---

## 5. بعد كل مهمة — الإلزامي

```
✅ تحقق: npm test تمر جميعاً
✅ تحقق: TypeScript بدون errors (npx tsc --noEmit)
✅ تحقق: لا console.log نسيتها
✅ تحقق: لا any جديدة بدون تبرير
✅ حدّث: .env.example إذا أضفت ENV var
✅ حدّث: Swagger إذا أضفت endpoint
✅ حدّث: CHANGELOG.md إذا كان تغيير مهم
✅ حدّث: replit.md إذا كان fix أو قرار معماري
✅ حدّث: .agents/memory/ إذا تعلمت شيئاً غير واضح من الكود

إذا أنشأت debt: وثّقه في TODO comment + Debt Register
إذا وجدت bug: وثّقه ثم اسأل هل تُصلحه أم تفتح issue
إذا لاحظت code smell: وثّقه في TODO — لا تعدّل خارج نطاق مهمتك
```

---

## 6. المناطق الحرجة — انتبه بشكل خاص

```typescript
// 🔴 CRITICAL ZONE 1: Financial Logic
server/modules/wallet/wallet.service.ts
server/modules/ledger/ledger.service.ts
  → أي تغيير هنا يتطلب Unit Tests كاملة
  → أي تغيير يمس المبالغ يتطلب Decimal arithmetic صريحاً
  → كل عملية في db.transaction()

// 🔴 CRITICAL ZONE 2: Authentication
server/middleware/authenticate.ts
server/middleware/authorize.ts
server/modules/auth/auth.service.ts
  → أي تغيير يتطلب مراجعة أمنية
  → لا تغيير في JWT expiry أو verification بدون موافقة

// 🔴 CRITICAL ZONE 3: DB Schema
shared/schema.ts
  → أي إضافة عمود يحتاج migration
  → أي حذف عمود يحتاج migration + backup أولاً
  → الـ enums الموجودة (role, status) لا تتغير بدون migration

// 🟠 HIGH RISK ZONE 4: Route Ordering
client/src/App.tsx
  → الترتيب مهم! Specific routes تسبق Wildcard routes
  → مثال: /store/dashboard قبل /store/:id

// 🟠 HIGH RISK ZONE 5: Socket.IO Events
server/modules/chat/chat.socket.ts
client/src/hooks/use-chat-socket.ts
  → تغيير event names يكسر التزامن بين client و server
  → client و server يجب أن يتزامنا دائماً
```

---

## 7. إذا لم تجد المعلومة

```
الترتيب:
  1. ابحث في الكود (grep, glob)
  2. ابحث في replit.md
  3. ابحث في docs/
  4. ابحث في .agents/memory/
  5. إذا لم تجد → قل "المعلومة غير متاحة في الكود الحالي"
     واسأل المستخدم عن السياق المطلوب

❌ لا تخمن ولا تفترض
❌ لا تخترع قرارات تجارية
❌ لا تقل "على الأرجح" ثم تُنفِّذ بناءً عليه
```

---

## 8. درس من تاريخ المشروع

```
هذه الأخطاء حدثت فعلاً وتسببت في إصلاحات ضخمة (موثقة في replit.md):

❌ db-auto-verify.ts كانت تحذف جميع المتاجر عند كل restart
   الدرس: لا test code في production files أبداً

❌ register endpoint كان يُوافق على جميع الحسابات تلقائياً
   الدرس: Default values الأمنية دائماً "الأكثر تقييداً"

❌ /store/dashboard كان يُطابَق كـ /store/:id بسبب ترتيب routes
   الدرس: راجع Route ordering دائماً في App.tsx

❌ wallet balance كانت تُضاف بدون ledger entry
   الدرس: كل عملية مالية = wallet + ledger في نفس transaction

❌ localStorage.getItem("token") بدلاً من "jwt_token"
   الدرس: دائماً ابحث عن الـ key المستخدم فعلاً قبل الكتابة
```
