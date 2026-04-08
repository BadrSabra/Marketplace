# دليل النشر التلقائي - منصة مع جابر

## كيف يعمل النظام

```
أنت تكتب كوداً → git push → GitHub → ينشر تلقائياً على Render
```

---

## الخطوة 1: رفع الكود على GitHub

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/اسمك/mit-gaber.git
git push -u origin main
```

---

## الخطوة 2: إعداد Render (مرة واحدة فقط)

1. افتح [render.com](https://render.com) وأنشئ حساباً مجانياً
2. اضغط **New** → **Blueprint**
3. اربط حساب GitHub واختر مستودع المشروع
4. Render سيقرأ ملف `render.yaml` ويُعد كل شيء تلقائياً:
   - ✅ خادم Node.js
   - ✅ قاعدة بيانات PostgreSQL
   - ✅ متغيرات البيئة

---

## الخطوة 3: ربط GitHub Actions بـ Render

1. في Render: اذهب للخدمة → **Settings** → **Deploy Hook** → انسخ الرابط
2. في GitHub: اذهب للمستودع → **Settings** → **Secrets** → **New secret**
   - الاسم: `RENDER_DEPLOY_HOOK`
   - القيمة: الرابط المنسوخ

---

## النتيجة النهائية

بعد الإعداد مرة واحدة، كل ما تحتاجه هو:

```bash
git add .
git commit -m "تحديث جديد"
git push
```

GitHub Actions سيتحقق من الكود ثم ينشره تلقائياً على Render!

---

## متغيرات البيئة المطلوبة

انظر ملف `.env.example` للاطلاع على جميع المتغيرات المطلوبة.
