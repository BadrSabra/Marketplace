# 22 — Documentation Plan
**قائمة جميع الوثائق المطلوبة مع ترتيب الكتابة**

---

## المرحلة 1 — Critical (قبل v1.0.0)

| الترتيب | الوثيقة | الجمهور | المسؤول | الحالة |
|---------|---------|---------|---------|-------|
| 1 | **README.md** (جذر المشروع) | مطورون | Senior Dev | ⚠️ يحتاج تحديث كامل |
| 2 | **Installation Guide** | مطورون | Senior Dev | ❌ |
| 3 | **Environment Variables Reference** | مطورون / DevOps | DevOps | ❌ |
| 4 | **API Documentation** (Swagger/OpenAPI) | مطورون + B2B | Backend | ❌ |
| 5 | **Deployment Guide** (Replit + VPS + Docker) | DevOps | DevOps | ❌ |
| 6 | **Database Schema Reference** | مطورون | Backend | ⚠️ جزئي في replit.md |
| 7 | **Privacy Policy** (Arabic + English) | مستخدمون | Legal/CEO | ❌ |
| 8 | **Terms of Service** (Arabic + English) | مستخدمون | Legal/CEO | ❌ |

---

## المرحلة 2 — High (قبل v1.1.0)

| الترتيب | الوثيقة | الجمهور | الحالة |
|---------|---------|---------|-------|
| 9 | **User Guide** — دليل العميل (Arabic) | عملاء | ❌ |
| 10 | **Store Owner Guide** — دليل صاحب المتجر (Arabic) | أصحاب متاجر | ❌ |
| 11 | **Driver Guide** — دليل السائق (Arabic) | سائقون | ❌ |
| 12 | **Admin Guide** — دليل الأدمن (Arabic) | admins | ❌ |
| 13 | **Architecture Overview** (diagrams) | مطورون | ⚠️ جزئي |
| 14 | **Security Guide** (how we protect data) | B2B عملاء | ❌ |
| 15 | **Contribution Guide** (للـ open source) | مطورون | ❌ |

---

## المرحلة 3 — Medium (قبل v2.0.0)

| الترتيب | الوثيقة | الجمهور | الحالة |
|---------|---------|---------|-------|
| 16 | **SaaS Onboarding Guide** | Tenant Admins | ❌ |
| 17 | **Tenant Admin Guide** | Tenant Admins | ❌ |
| 18 | **White Label Guide** (كيفية التخصيص) | White Label clients | ❌ |
| 19 | **Customization Guide** (Themes/Colors/Logo) | Technical clients | ❌ |
| 20 | **Webhook Integration Guide** | مطورون B2B | ❌ |
| 21 | **API Changelog** | مطورون | ❌ |
| 22 | **CHANGELOG.md** | الجميع | ❌ |
| 23 | **SLA Document** | Enterprise clients | ❌ |

---

## المرحلة 4 — Low (قبل v3.0.0)

| الترتيب | الوثيقة | الجمهور | الحالة |
|---------|---------|---------|-------|
| 24 | **Mobile App Developer Guide** | React Native devs | ❌ |
| 25 | **SDK Documentation** (JS/Python) | مطورون | ❌ |
| 26 | **Enterprise Integration Guide** (SSO/SAML) | IT Enterprise | ❌ |
| 27 | **Disaster Recovery Runbook** | DevOps | ❌ |
| 28 | **Incident Response Playbook** | DevOps + Support | ❌ |
| 29 | **Support Knowledge Base** | Support team | ❌ |
| 30 | **Video Tutorials** (YouTube) | الجميع | ❌ |

---

## هيكل README.md المثالي

```markdown
# مع جابر — Hyperlocal Marketplace

## Quick Start (5 minutes)
## Prerequisites
## Installation
## Environment Setup
## Running the App
## Architecture Overview
## API Documentation
## Deployment
## Contributing
## License
```

---

## هيكل Swagger API Docs

```
تُنظَّم حسب Tags:
  🔐 Authentication (register, login, me)
  💰 Wallet (balance, deposit, withdraw, approve)
  🛒 Orders (create, list, cancel)
  🏪 Stores (list, get, update)
  📦 Products (CRUD)
  🚗 Delivery (offers, OTP)
  💬 Chat (rooms, messages)
  🔔 Notifications (list, read, subscribe)
  👨‍💼 Admin (users, stats, orders, audit)
  🌐 Public (stores, products)

كل endpoint يحتوي على:
  - Description (Arabic + English)
  - Request schema (Zod → OpenAPI)
  - Response schema
  - Error responses (400, 401, 403, 404, 500)
  - Example request/response
  - Authentication requirement
```

---

## أداوت التوثيق المستخدمة

| الأداة | الغرض |
|--------|-------|
| Swagger UI Express | API Documentation |
| zod-to-openapi | تحويل Zod schemas → OpenAPI |
| Markdown | جميع الوثائق النصية |
| Mermaid | الرسومات التوضيحية |
| draw.io | معمارية المشروع |

---

## معايير جودة التوثيق

```
✅ كل endpoint موثق بمثال حقيقي
✅ Screenshots محدثة مع كل UI change
✅ كل Error code موثق بالسبب والحل
✅ كل حقل في DB موثق بالوصف والنوع والقيود
✅ تحديث الـ CHANGELOG مع كل release
✅ مراجعة التوثيق ضمن Definition of Done
```
