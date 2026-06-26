# 17 — White Label Checklist

---

## Branding

| # | البند | الحالة | التعديل المطلوب |
|---|-------|--------|----------------|
| WL-01 | تغيير اسم النظام (Brand Name) | ❌ | config variable في env |
| WL-02 | شعار (Logo) — رفع وعرض | ⚠️ | Upload موجود، يحتاج dynamic rendering |
| WL-03 | Favicon مخصص | ❌ | Dynamic favicon per tenant |
| WL-04 | ألوان رئيسية (Primary Colors) | ⚠️ | CSS variables موجودة، تحتاج dynamic loading |
| WL-05 | ألوان ثانوية (Secondary Colors) | ⚠️ | نفس السابق |
| WL-06 | Typography / Font | ❌ | Custom font per tenant |
| WL-07 | Dark/Light mode per tenant | ❌ | Sprint 8 |

---

## Domains & URLs

| # | البند | الحالة | التعديل المطلوب |
|---|-------|--------|----------------|
| DOM-01 | Custom subdomain (client.mitgaber.com) | ❌ | Nginx + DNS wildcard |
| DOM-02 | Custom domain (app.client.com) | ❌ | Let's Encrypt + Nginx config |
| DOM-03 | Domain verification (DNS TXT record) | ❌ | Sprint 9 |
| DOM-04 | URL rewriting per tenant | ❌ | Middleware + Nginx |

---

## Emails

| # | البند | الحالة | التعديل المطلوب |
|---|-------|--------|----------------|
| EMAIL-01 | From email مخصص (noreply@client.com) | ❌ | Per-tenant SMTP config |
| EMAIL-02 | Email templates بشعار tenant | ❌ | Dynamic templates |
| EMAIL-03 | Email footer بمعلومات tenant | ❌ | Sprint 8 |
| EMAIL-04 | Transactional emails بعلامة tenant | ⚠️ | Nodemailer موجود، يحتاج per-tenant |

---

## Push Notifications

| # | البند | الحالة | التعديل المطلوب |
|---|-------|--------|----------------|
| PUSH-01 | VAPID keys per tenant | ❌ | Per-tenant key generation |
| PUSH-02 | Notification icon بشعار tenant | ❌ | Dynamic icon in push payload |
| PUSH-03 | App name في notifications | ❌ | Dynamic app name |

---

## Mobile App Branding (يتطلب React Native)

| # | البند | الحالة | التعديل المطلوب |
|---|-------|--------|----------------|
| MOB-01 | App name | ❌ | بعد بناء React Native |
| MOB-02 | App icon | ❌ | Per-client icon assets |
| MOB-03 | Splash screen | ❌ | Per-client splash |
| MOB-04 | App Store listing | ❌ | Per-client screenshots + description |
| MOB-05 | Play Store listing | ❌ | Per-client assets |
| MOB-06 | Bundle ID / Package Name | ❌ | Per-client (مطلوب للنشر) |

---

## Customer Portal

| # | البند | الحالة | التعديل المطلوب |
|---|-------|--------|----------------|
| CP-01 | Landing page مخصصة per tenant | ❌ | Dynamic LandingPage component |
| CP-02 | "About" page مخصصة | ❌ | Tenant CMS |
| CP-03 | Terms & Privacy مخصصة per tenant | ❌ | Sprint 9 |
| CP-04 | Support contact مخصص | ❌ | Tenant settings |

---

## Store Assets

| # | البند | الحالة | التعديل المطلوب |
|---|-------|--------|----------------|
| SA-01 | صورة المتجر الافتراضية | ⚠️ | موجودة، تحتاج per-tenant default |
| SA-02 | صورة المنتج الافتراضية | ⚠️ | موجودة، تحتاج per-tenant |
| SA-03 | واجهة المتجر العامة بألوان tenant | ❌ | Dynamic theming |

---

## Documentation & Legal

| # | البند | الحالة | التعديل المطلوب |
|---|-------|--------|----------------|
| DOC-01 | White Label Agreement | ❌ | Legal document |
| DOC-02 | Customization Guide للعميل | ❌ | Sprint 8 |
| DOC-03 | Rebranding Checklist للعميل | ❌ | Sprint 8 |

---

## خطوات تسليم White Label لعميل جديد

```
1. إعداد subdomain أو domain
2. رفع الشعار والألوان
3. تحديث env variables (BRAND_NAME, CONTACT_EMAIL)
4. إعداد SMTP بـ domain العميل
5. إنشاء tenant admin account
6. تسليم White Label Agreement
7. دورة تدريبية للفريق (2-4 ساعات)
8. فترة دعم فني مكثفة (2 أسابيع)
```

---

## ملخص جاهزية White Label

```
Total items: 30
✅ مكتمل:        0 (0%)
⚠️ جزئي:       10 (33%)
❌ غير موجود:   20 (67%)

الجاهزية الحالية: 17/100
الجاهزية المستهدفة (شهر 5): 75/100
```
