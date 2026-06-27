# 17 — Final Constitution
**الدستور الختامي — المبادئ غير القابلة للتفاوض**

---

## الإعلان

هذا الدستور هو **القانون الأعلى** لمشروع "مع جابر".  
كل قرار تقني، كل سطر كود، كل تغيير في قاعدة البيانات — يُقاس على هذا الدستور قبل تنفيذه.

**لا استثناء بدون توثيق مكتوب وموافقة صريحة.**

---

## المبادئ غير القابلة للتفاوض

### I. المال أمانة

```
المشروع يتعامل مع أموال مستخدمين حقيقيين.

✦ كل عملية مالية تجري داخل DB transaction واحد
✦ كل عملية = قيد في wallet_transactions + قيد في ledger
✦ لا يُحذف سجل مالي أبداً
✦ المبالغ تُحسب بـ Decimal — لا floating point
✦ خطأ في المال لا يُعالَج بـ workaround — يُعالَج في جذره
```

### II. الأمان بالتصميم

```
✦ أي feature جديدة تُقيَّم أمنياً قبل التنفيذ
✦ Least privilege: كل مستخدم يصل لما يحتاجه فقط
✦ لا secret في الكود — env vars دائماً
✦ لا trust للـ client — server يتحقق من كل شيء
✦ Audit log على كل قرار إداري ومالي
```

### III. الكود مقروء للبشر أولاً

```
✦ الكود يُكتب ليُقرأ، لا ليُنفَّذ فقط
✦ اسم واصف > تعليق طويل
✦ دالة صغيرة بمسؤولية واحدة > دالة ضخمة بكل شيء
✦ الوضوح يتقدم على الذكاء
✦ الكود الذي يعمل لكن لا يُفهم هو عبء لا ميزة
```

### IV. الاختبار ضمان لا عبء

```
✦ الكود بدون tests هو وعد لا ضمان
✦ Business logic حرجة (مال، auth، state machine) → Unit Tests إلزامية
✦ كل bug fix له regression test يمنع تكراره
✦ Tests تُكتب للسلوك، لا للتطبيق
```

### V. التوثيق جزء من العمل

```
✦ API بدون Swagger غير مكتملة
✦ ENV var بدون .env.example خطأ
✦ قرار تقني مهم بدون توثيق دين مستقبلي
✦ CHANGELOG.md شاهد حي على تطور المشروع
```

### VI. المعمارية ليست ديكوراً

```
✦ حدود الطبقات إلزامية — Router → Controller → Service → Storage
✦ Business logic في Service، لا في Controller أو UI
✦ DB queries في Storage، لا في أي مكان آخر
✦ shared/schema.ts هو المصدر الوحيد للـ types
✦ اختصار معماري = دين تقني يتضاعف
```

### VII. التغيير بحذر، الاستقرار بأولوية

```
✦ لا تكسر API موجودة — versioning عند الحاجة
✦ لا تُعدِّل schema بدون migration + rollback
✦ لا تُضيف dependency قبل تقييم أثرها
✦ لا breaking change بدون موافقة + إشعار مسبق
✦ Rollback plan جاهز قبل كل major release
```

---

## القواعد الذهبية العشر

```
01. المال + DB Transaction + Ledger = ثالوث لا يتجزأ
02. Security by Default — آمن حتى يثبت العكس
03. لا console.log في production — لا exceptions
04. لا any بدون مبرر موثق — TypeScript strict
05. لا PR بدون Tests تمر
06. لا endpoint بدون Auth + RBAC (ما لم يكن /public/ صراحة)
07. لا magic numbers — ثوابت مسماة دائماً
08. لا TODO بدون Backlog ticket رقمه
09. لا workaround يُبقى أكثر من Sprint واحد بدون issue
10. كل قرار لا تفهم سببه → اسأل قبل التنفيذ
```

---

## ما يجب أن يفعله كل مساهم

```
قبل البدء:
  □ اقرأ الدستور الهندسي (هذه الوثائق)
  □ افهم الـ PRD وهدف الـ Sprint
  □ حلّل أثر مهمتك قبل الكتابة

أثناء التنفيذ:
  □ التزم بحدود الطبقات
  □ اكتب Tests مع الكود، لا بعده
  □ وثّق كل قرار غير واضح
  □ Boy Scout Rule: دائماً اترك الكود أنظف

قبل الـ PR:
  □ Self-review كامل
  □ Tests تمر
  □ TypeScript clean
  □ Swagger / .env.example محدَّثان
  □ CHANGELOG.md يعكس التغيير

بعد الـ Merge:
  □ راقب الـ Staging 30 دقيقة
  □ تأكد من الـ Production بعد Deploy
  □ وثّق أي مفاجأة في .agents/memory/
```

---

## ما لا يُسمح به

```
🚫 business logic في React components
🚫 DB queries خارج Storage layer
🚫 secrets في الكود أو الـ logs
🚫 direct commits على main أو develop
🚫 merge بدون Tests تمر
🚫 تعديل wallet.service.ts بدون unit tests
🚫 DB migration بدون rollback script
🚫 breaking API change بدون versioning
🚫 console.log في production code
🚫 any في TypeScript بدون تبرير موثق
🚫 تجاهل failing test بدل إصلاحه
🚫 workaround أمني "مؤقت"
🚫 إعادة اختراع utility موجودة
🚫 حذف كود بدون grep للاستخدامات أولاً
🚫 تجاهل code review comments
```

---

## كيف نحافظ على جودة المشروع على المدى الطويل

### الإجراءات الدورية

| التكرار | الإجراء | المسؤول |
|---------|---------|---------|
| يومياً | Daily standup + Sentry review | الفريق |
| أسبوعياً | npm audit + pg_stat_statements review | DevOps |
| كل Sprint | Retrospective + Debt Register review | الفريق |
| شهرياً | Security scan (OWASP ZAP) + Backup restore test | Lead Dev |
| ربع سنوي | مراجعة الدستور الهندسي (تحديث إن لزم) | Lead Dev |
| قبل كل release | Load test + E2E test + Security scan | DevOps + QA |

### مؤشرات صحة المشروع

```
🟢 صحي:
  Unit test coverage ≥ 80%
  p99 API response < 2s
  Error rate < 1%
  Debt Ratio < 20%
  Security scan: لا Critical findings
  Lighthouse Score ≥ 85

🟡 يحتاج انتباهاً:
  Coverage بين 60-80%
  p99 بين 2-4s
  Error rate بين 1-5%
  Debt Ratio بين 20-30%

🔴 يحتاج تدخلاً فورياً:
  Coverage < 60%
  p99 > 4s أو Error rate > 5%
  Critical security finding
  Debt Ratio > 30%
```

---

## مراجعة وتحديث الدستور

```
الدستور ليس ثابتاً إلى الأبد — لكنه لا يتغير بسهولة.

شروط تعديل الدستور:
  1. اقتراح مكتوب يشرح التغيير والمبرر
  2. مراجعة من Lead Engineer
  3. موافقة الفريق (أغلبية)
  4. تحديث الدستور مع توثيق سبب التغيير
  5. إبلاغ جميع المساهمين

ما لا يتغير أبداً (Core Invariants):
  ✦ المال + DB Transaction + Ledger
  ✦ Security by Default
  ✦ لا secrets في الكود
  ✦ Tests إلزامية للـ business logic
  ✦ لا breaking changes بدون versioning
```

---

## الكلمة الأخيرة

> **"البرمجيات لا تتحلل كما تتحلل الأشياء المادية — بل تتحلل عندما يتوقف الناس عن الاهتمام."**

جودة هذا المشروع هي مسؤولية جماعية.  
كل مطوّر، كل وكيل ذكاء اصطناعي، كل مراجع — يحمل جزءاً من هذه المسؤولية.

الدستور هو عهد مشترك:  
**نبني لنبقى، لا لنُصلح.**

---

*آخر تحديث: 26 يونيو 2026 | الإصدار: 1.0*  
*المرجع التالي: راجع كل 3 أشهر أو عند تغيير جوهري في المشروع*
