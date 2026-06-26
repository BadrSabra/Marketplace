# 05 — Definition of Ready (DoR)
**متى تعتبر المهمة جاهزة للتنفيذ؟**

---

## الشروط الإلزامية (يجب توفر الجميع)

### 1. الوضوح الوظيفي
- [ ] User Story مكتوبة بصيغة: "بصفتي [دور] أريد [ميزة] حتى [قيمة]"
- [ ] Acceptance Criteria محددة ولا تحتمل التأويل
- [ ] السلوك المتوقع موثق لحالات النجاح والفشل
- [ ] UX mockup أو wireframe موجود (إن كانت واجهة)

### 2. الوضوح التقني
- [ ] الملفات التي ستتأثر محددة بالاسم
- [ ] الـ API endpoints المطلوبة محددة (method + path + request/response)
- [ ] تغييرات DB Schema (إن وجدت) موثقة
- [ ] الاعتماديات على مهام أخرى محددة

### 3. التحقق من عدم الكسر
- [ ] تأثير التغيير على الميزات الحالية مُقيَّم
- [ ] لا يكسر أي route موجود
- [ ] لا يُغيّر سلوكاً يعتمد عليه frontend بدون تنسيق
- [ ] backward compatibility للـ API مضمونة أو documented

### 4. الأولوية والحجم
- [ ] Priority مُحدد (Critical/High/Medium/Low)
- [ ] Complexity مُقدَّرة (XS/S/M/L/XL)
- [ ] Story Points أو Estimated Hours مُحددة
- [ ] تناسب Sprint الحالي (لا تتجاوز 40% من sprint capacity)

### 5. الاستقلالية
- [ ] لا تعتمد على مهمة غير مكتملة
- [ ] يمكن اختبارها بشكل مستقل
- [ ] لا تتضمن placeholder أو TODO يؤخر الإتمام

---

## Definition of NOT Ready (تجنّب هذه الحالات)

```
❌ "اعمل login page" — بدون wireframe أو acceptance criteria
❌ مهمة تعتمد على sprint سابق غير مكتمل
❌ "تحسين الأداء" — بدون metrics مستهدفة محددة
❌ تغيير DB بدون migration plan
❌ مهمة تمس auth/payments/ledger بدون security review أولاً
❌ feature جديدة تعتمد على Redis قبل تنصيب Redis
```
