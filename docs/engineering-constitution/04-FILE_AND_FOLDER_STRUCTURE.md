# 04 — File & Folder Structure
**هيكل المجلدات المعتمد والإلزامي**

---

## الهيكل الكامل

```
mit-gaber/
├── client/                          # كل ما يراه المستخدم (React + Vite)
│   ├── public/                      # ملفات ثابتة (sw.js, manifest.json, icons)
│   └── src/
│       ├── components/              # مكونات قابلة لإعادة الاستخدام
│       │   ├── ui/                  # shadcn/ui components (لا تُعدَّل مباشرة)
│       │   └── <feature>/           # مكونات خاصة بـ feature (notification-bell, etc.)
│       ├── hooks/                   # Custom React hooks فقط
│       │   ├── use-auth.ts          # Auth state
│       │   ├── use-chat-socket.ts   # Socket.IO
│       │   └── use-<feature>.ts     # كل hook في ملفه
│       ├── lib/                     # Utilities & helpers (client-side)
│       │   ├── queryClient.ts       # TanStack Query setup
│       │   ├── api.ts               # apiFetch helper
│       │   └── utils.ts             # cn() وغيره
│       ├── pages/                   # صفحات مُنظَّمة حسب الدور
│       │   ├── admin/               # صفحات الأدمن
│       │   ├── customer/            # صفحات العميل
│       │   ├── driver/              # صفحات السائق
│       │   ├── store/               # صفحات صاحب المتجر
│       │   ├── chat/                # صفحات الـ Chat (مشترك)
│       │   └── auth/                # Login, Register
│       ├── i18n/                    # ملفات الترجمة
│       │   └── ar.ts                # Arabic translations
│       ├── App.tsx                  # Router الرئيسي
│       └── main.tsx                 # Entry point
│
├── server/                          # Backend (Express 5)
│   ├── modules/                     # كل feature في module مستقل
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.router.ts
│   │   ├── wallet/
│   │   │   ├── wallet.controller.ts
│   │   │   ├── wallet.service.ts
│   │   │   └── wallet.router.ts
│   │   ├── orders/
│   │   ├── stores/
│   │   ├── products/
│   │   ├── delivery/
│   │   ├── chat/
│   │   ├── notifications/
│   │   ├── admin/
│   │   └── public/
│   ├── middleware/                  # Express middlewares
│   │   ├── authenticate.ts          # JWT verification
│   │   ├── authorize.ts             # RBAC
│   │   ├── rateLimiter.ts           # Rate limiting
│   │   ├── upload.ts                # File upload (Multer → S3)
│   │   └── errorHandler.ts          # Global error handler
│   ├── lib/                         # Server-side libraries/clients
│   │   ├── redis.ts                 # Redis client singleton
│   │   ├── storage-provider.ts      # S3/Cloudinary abstraction
│   │   ├── email.ts                 # Email client
│   │   └── stripe.ts                # Stripe client
│   ├── utils/                       # Server-side utilities
│   │   ├── validation.ts            # validateUUID, validateEmail
│   │   ├── money.ts                 # Decimal arithmetic
│   │   ├── response.ts              # Standardized responses
│   │   └── pagination.ts            # Pagination helpers
│   ├── storage.ts                   # IStorage interface + implementation
│   ├── routes.ts                    # Mount routers only (< 50 سطر)
│   ├── db.ts                        # DB connection (Drizzle + Pool)
│   ├── vite.ts                      # Vite integration (لا تعدّل)
│   └── index.ts                     # Express app setup
│
├── shared/                          # مشترك بين client و server
│   ├── schema.ts                    # DB schema + Zod schemas + Types
│   └── routes.ts                    # Shared types (User, etc.)
│
├── docs/                            # التوثيق الكامل
│   ├── engineering-constitution/    # هذا الدستور
│   ├── project-management/          # إدارة المشروع (23 وثيقة)
│   ├── project-analysis-report.md   # التقرير التقني
│   └── PRD-and-roadmap.md           # PRD وخارطة الطريق
│
├── backups/                         # DB backups (مُستبعدة من git)
├── uploads/                         # ملفات محلية مؤقتة (→ S3 قريباً)
├── migrations/                      # Drizzle migrations
├── .env.example                     # نموذج متغيرات البيئة
├── .gitignore
├── drizzle.config.ts                # لا تعدّل
├── vite.config.ts                   # لا تعدّل
├── package.json                     # لا تعدّل scripts بدون موافقة
├── tsconfig.json
└── replit.md                        # Project overview
```

---

## وظيفة كل مجلد

| المجلد | الوظيفة | من يكتب فيه |
|--------|---------|------------|
| `client/src/pages/` | صفحات كاملة مرتبطة بـ route | Frontend dev |
| `client/src/components/ui/` | shadcn components — **لا تُعدَّل مباشرة** | لا أحد (generated) |
| `client/src/components/<feature>/` | مكونات خاصة قابلة للإعادة | Frontend dev |
| `client/src/hooks/` | Custom hooks (data fetching, state) | Frontend dev |
| `client/src/lib/` | Pure utilities, no React | Frontend dev |
| `server/modules/<feature>/` | Business feature كاملة | Backend dev |
| `server/middleware/` | Express middleware | Backend dev |
| `server/lib/` | External service clients (singletons) | Backend dev |
| `server/utils/` | Pure utility functions | Backend dev |
| `shared/schema.ts` | **المصدر الوحيد للـ types** | Lead dev (بعناية) |
| `docs/` | توثيق فقط، لا كود | جميع الأدوار |

---

## القواعد الإلزامية

```
✦ FS-01: ممنوع وضع ملفات عشوائية في الجذر (/)
         الجذر يحتوي: package.json, tsconfig.json, drizzle.config.ts,
         vite.config.ts, .env.example, .gitignore, replit.md فقط

✦ FS-02: ممنوع خلط business logic مع UI
         pages/ لعرض البيانات فقط، المنطق في hooks/ أو server/

✦ FS-03: ممنوع وضع DB queries في client/
         العميل لا يعرف شيئاً عن DB

✦ FS-04: ممنوع تكرار نفس النوع من الملفات في أكثر من مكان
         مثال: لا validateUUID في wallet.controller.ts وorders.controller.ts معاً
         → مكانها server/utils/validation.ts

✦ FS-05: أي مجلد جديد يجب توثيق وظيفته في هذا الملف قبل إنشائه

✦ FS-06: server/modules/<feature>/ لكل feature جديدة — لا إضافة routes في routes.ts مباشرة

✦ FS-07: shared/schema.ts هو المصدر الوحيد للـ DB types
         لا تُنشئ type مكررة في server/ أو client/

✦ FS-08: uploads/ مؤقت فقط للـ development
         في production: جميع الملفات على S3

✦ FS-09: backups/ و uploads/ مُدرجان في .gitignore (لا تُنشر للـ repo)

✦ FS-10: لا تعدّل: drizzle.config.ts, vite.config.ts, server/vite.ts
         إلا بموافقة Lead Engineer وتوثيق السبب
```

---

## نمط التسمية للملفات

```
server/modules/<feature>/
  <feature>.controller.ts    ✅
  <feature>.service.ts       ✅
  <feature>.router.ts        ✅
  <feature>.spec.ts          ✅ (unit tests)

client/src/
  pages/<role>/<page-name>.tsx      ✅ (customer/wallet.tsx)
  hooks/use-<feature>.ts            ✅ (use-chat-socket.ts)
  components/<category>/<name>.tsx  ✅ (ui/notification-bell.tsx)

shared/
  schema.ts    ✅ (ملف واحد فقط)
  routes.ts    ✅ (shared types)
```
