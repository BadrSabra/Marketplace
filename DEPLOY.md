# النشر الذاتي التلقائي - منصة مع جابر

## كيف يعمل النظام

```
git push → GitHub → يُرسل إشارة لـ /api/deploy/webhook → التطبيق يحدث نفسه بنفسه
```

لا تحتاج لأي منصة نشر خارجية. التطبيق يحتوي على آلية النشر بداخله.

---

## الإعداد (مرة واحدة فقط)

### الخطوة 1: رفع الكود على GitHub

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/اسمك/mit-gaber.git
git push -u origin main
```

### الخطوة 2: تشغيل التطبيق على أي خادم

```bash
git clone https://github.com/اسمك/mit-gaber.git
cd mit-gaber
cp .env.example .env
# عدّل ملف .env بمتغيراتك الحقيقية
npm install
npm run build
npm start
```

### الخطوة 3: ربط GitHub بالتطبيق

1. اذهب للمستودع على GitHub → **Settings** → **Webhooks** → **Add webhook**
2. أدخل البيانات التالية:
   - **Payload URL:** `https://نطاقك.com/api/deploy/webhook`
   - **Content type:** `application/json`
   - **Secret:** نفس قيمة `GITHUB_WEBHOOK_SECRET` في ملف `.env`
   - **Events:** اختر `Just the push event`
3. اضغط **Add webhook**

---

## كيف يعمل بعد الإعداد

```bash
git add .
git commit -m "تحديث جديد"
git push
```

1. GitHub يُرسل إشارة فورية للتطبيق
2. التطبيق يسحب آخر الكود تلقائياً
3. يُعيد بناء نفسه
4. يُعيد تشغيل نفسه

---

## مراقبة حالة النشر

```
GET /api/deploy/status
```

يُظهر آخر 10 عمليات نشر مع حالة كل منها.

---

## المتغيرات المطلوبة

انظر ملف `.env.example` للاطلاع على جميع المتغيرات.
