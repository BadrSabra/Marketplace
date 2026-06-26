# تقرير التحليل الشامل لمشروع "مع جابر" - Hyperlocal Marketplace
**تاريخ التقرير:** 26 يونيو 2026  
**نوع التقرير:** وثيقة تقنية رسمية شاملة  
**أعدّه:** Senior Software Architect — تحليل كامل بدون تعديل أي ملف

---

## 1. هيكل المشروع بالكامل

### المجلدات الرئيسية

```
/
├── client/                  # الواجهة الأمامية (React + Vite)
│   ├── public/              # ملفات ثابتة (sw.js - Service Worker)
│   └── src/
│       ├── App.tsx          # نقطة دخول التطبيق + Router الرئيسي
│       ├── main.tsx         # تهيئة React DOM
│       ├── index.css        # متغيرات CSS العامة (Tailwind)
│       ├── i18n.ts          # إعداد نظام الترجمة
│       ├── components/      # مكونات واجهة المستخدم
│       │   ├── ui/          # مكونات Shadcn/Radix (40+ مكوّن)
│       │   ├── layout/      # Navbar, Footer, admin-layout, store-layout
│       │   ├── driver/      # DriverNavbar
│       │   ├── customer/    # ProductCard
│       │   └── home/        # HeroSection, StoreCard, StoreGrid
│       ├── hooks/           # React Hooks المخصصة (12 hook)
│       ├── i18n/            # ترجمات العربية (ar.ts)
│       ├── lib/             # queryClient, api.ts, utils
│       ├── locales/         # ملفات JSON للترجمة
│       └── pages/           # صفحات التطبيق مقسمة بالأدوار
│           ├── admin/       # 10 صفحات إدارية
│           ├── auth/        # login, register
│           ├── chat/        # index (قائمة), room (محادثة)
│           ├── customer/    # 6 صفحات + مجلد store/ (5 صفحات)
│           ├── driver/      # 6 صفحات
│           └── public/      # LandingPage, StoresPage, PublicStorePage, HowItWorks, about, faq
│
├── server/                  # الواجهة الخلفية (Express.js)
│   ├── index.ts             # نقطة دخول الخادم + تهيئة Middleware
│   ├── routes.ts            # تعريف جميع API Routes (~1200 سطر)
│   ├── storage.ts           # طبقة الوصول لقاعدة البيانات (Data Access Layer)
│   ├── db.ts                # اتصال PostgreSQL عبر Drizzle ORM
│   ├── seed.ts              # بيانات أولية للتطوير
│   ├── static.ts            # خدمة الملفات الثابتة في الإنتاج
│   ├── vite.ts              # تكامل Vite في وضع التطوير
│   ├── bootstrap/
│   │   ├── database.bootstrap.ts  # إنشاء الجداول تلقائياً عند الإقلاع
│   │   └── db-auto-verify.ts      # التحقق من سلامة قاعدة البيانات
│   ├── middleware/
│   │   ├── auth.ts          # JWT authentication + RBAC authorization
│   │   ├── security.ts      # Security headers + Rate limiters
│   │   └── error.ts         # معالجة الأخطاء المركزية + Request ID
│   ├── modules/             # وحدات الأعمال (Feature Modules)
│   │   ├── admin/           # health.controller.ts
│   │   ├── audit/           # audit.service.ts, audit.middleware.ts
│   │   ├── avatar/          # رفع صور المستخدمين
│   │   ├── chat/            # chat.service, chat.controller, chat.socket
│   │   ├── delivery/        # delivery.service, deliveryOffer, deliveryOtp
│   │   ├── deploy/          # deploy.controller.ts
│   │   ├── deposits/        # deposits.controller
│   │   ├── integrity/       # health.spec.ts
│   │   ├── ledger/          # ledger.controller, ledger.service
│   │   ├── notifications/   # push.service, notification.service, routes
│   │   ├── orders/          # order.service, suborder.service, controllers
│   │   ├── products/        # products.service, products.controller
│   │   ├── public/          # public.controller (public store endpoints)
│   │   ├── receipt/         # رفع إيصالات الإيداع
│   │   ├── store/           # رفع صور المتاجر
│   │   └── wallet/          # wallet.service, wallet.controller
│   ├── scripts/             # سكريبتات صيانة قاعدة البيانات
│   ├── services/            # auditService, transactionWrapper
│   ├── types/               # express.d.ts (type extensions)
│   └── utils/               # money.ts (precision arithmetic)
│
├── shared/                  # كود مشترك بين Frontend و Backend
│   ├── schema.ts            # تعريف جداول قاعدة البيانات + Zod schemas
│   └── routes.ts            # تعريف API routes + أنواع TypeScript
│
├── uploads/                 # ملفات المستخدمين المرفوعة
│   ├── avatars/             # صور المستخدمين
│   ├── products/            # صور المنتجات
│   ├── receipts/            # إيصالات الإيداع
│   └── stores/              # صور المتاجر
│
├── backups/                 # نسخ احتياطية من قاعدة البيانات (.sql)
├── docs/                    # وثائق المشروع
├── logs/                    # ملفات سجل التشغيل (JSON)
├── package.json             # تبعيات المشروع
├── tsconfig.json            # إعدادات TypeScript
├── vite.config.ts           # إعدادات Vite
├── tailwind.config.ts       # إعدادات Tailwind CSS
├── postcss.config.js        # إعدادات PostCSS
├── drizzle.config.ts        # إعدادات Drizzle ORM
└── render.yaml              # إعدادات النشر على Render.com
```

### العلاقات بين الملفات الرئيسية

```
shared/schema.ts ←── يُستخدم بـ ──→ server/storage.ts ←── يُستخدم بـ ──→ server/routes.ts
      ↓                                                                           ↓
client/src/lib/queryClient.ts ←── تُرسل طلبات HTTP ──→ server/routes.ts
      ↓
client/src/hooks/* ←── تستخدم ──→ client/src/pages/*
```

---

## 2. التقنيات المستخدمة

### لغات البرمجة
| اللغة | الإصدار | الاستخدام |
|-------|---------|-----------|
| TypeScript | 5.6.3 | Frontend + Backend + Shared |
| JavaScript | ES2020+ | ناتج البناء |
| SQL | PostgreSQL dialect | استعلامات قاعدة البيانات |
| CSS | Tailwind v4 | التنسيق |

### Frameworks والمكتبات الأساسية

**Backend:**
| المكتبة | الإصدار | الغرض |
|---------|---------|-------|
| Express.js | 5.0.1 | Web Framework |
| Drizzle ORM | 0.45.2 | Database ORM |
| Drizzle-Kit | 0.31.8 | Database Migration Tool |
| Socket.IO | 4.8.3 | Real-time WebSocket |
| JSON Web Token | 9.0.3 | Authentication |
| bcryptjs | 3.0.3 | Password Hashing |
| Multer | 2.1.1 | File Upload |
| web-push | 3.6.7 | Browser Push Notifications |
| Zod | 3.24.2 | Schema Validation |
| express-rate-limit | 8.2.2 | Rate Limiting |
| helmet | 8.1.0 | Security Headers |
| Nodemailer | 8.0.1 | Email Service |

**Frontend:**
| المكتبة | الإصدار | الغرض |
|---------|---------|-------|
| React | 18.3.1 | UI Framework |
| Vite | 7.3.2 | Build Tool / Dev Server |
| Wouter | 3.3.5 | Client-side Routing |
| TanStack Query | 5.60.5 | Server State Management |
| Radix UI | متعددة | Headless UI Components |
| Tailwind CSS | 4.2.1 | Utility-first CSS |
| shadcn/ui | مبني محلياً | Component Library |
| react-hook-form | 7.55.0 | Form Management |
| Framer Motion | 11.13.1 | Animations |
| Recharts | 2.15.2 | Charts |
| Socket.IO Client | 4.8.3 | Real-time Events |
| Lucide React | 0.453.0 | Icons |

### قاعدة البيانات
- **النوع:** PostgreSQL (relational)
- **ORM:** Drizzle ORM مع drizzle-zod
- **Connection Pool:** node-postgres (pg) مع إعدادات: max 20, idleTimeout 30s, connectionTimeout 5s

### أدوات البناء والنشر
| الأداة | الغرض |
|--------|-------|
| Vite | تجميع Frontend |
| tsx | تشغيل TypeScript في Development |
| esbuild | تجميع Backend للإنتاج |
| Drizzle-Kit | إدارة schema قاعدة البيانات |
| render.yaml | إعدادات النشر على Render.com |

### خدمات الطرف الثالث
| الخدمة | الغرض | الحالة |
|--------|-------|--------|
| Web Push (VAPID) | إشعارات المتصفح | مفعّل |
| Nodemailer (SMTP) | البريد الإلكتروني | مُعدّ (يحتاج SMTP server) |
| Render.com | استضافة الخادم | مُعدّ |
| خرائط | لا توجد تكامل | غير موجود |

---

## 3. معمارية النظام

### Architecture Pattern
**Monolithic Modular Architecture** — تطبيق واحد يجمع Frontend و Backend على نفس الخادم (Port 5000)، مقسّم داخلياً إلى وحدات بمبدأ **Feature-based Modular Structure**.

### طبقات المشروع

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                  │
│  React + Vite + TanStack Query + Socket.IO Client   │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Admin   │ │ Customer │ │ Driver  │ │ Store   │  │
│  │ Pages   │ │ Pages    │ │ Pages   │ │ Pages   │  │
│  └─────────┘ └──────────┘ └─────────┘ └─────────┘  │
└────────────────────────┬────────────────────────────┘
                         │ HTTP REST + WebSocket (WS)
┌────────────────────────▼────────────────────────────┐
│                   SERVER (Express.js)                │
│  ┌─────────────────────────────────────────────┐    │
│  │           Middleware Layer                   │    │
│  │  Security | Auth (JWT) | Rate Limit | Error │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │           Routes Layer (routes.ts)           │    │
│  │  Auth | Orders | Products | Wallet | Chat   │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │           Service Layer (modules/)           │    │
│  │  Business Logic + Validation + Transactions │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │        Data Access Layer (storage.ts)        │    │
│  │           Drizzle ORM Queries               │    │
│  └─────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────┘
                         │ SQL
┌────────────────────────▼────────────────────────────┐
│               PostgreSQL Database                    │
│         (Replit Neon / External PostgreSQL)          │
└─────────────────────────────────────────────────────┘
```

### تدفق البيانات
1. **HTTP Request:** المتصفح → Express Middleware → Route Handler → Service → Storage → DB
2. **Real-time:** Socket.IO (ws://) — للمحادثات والإشعارات الفورية
3. **Push Notifications:** Server → VAPID → Browser Service Worker

### إدارة الحالة (State Management)
- **Server State:** TanStack Query v5 (caching, invalidation, refetching)
- **Local State:** React useState/useReducer
- **Cart State:** React Context (`CartContext`)
- **Auth State:** Custom hook (`use-auth.ts`) يُخزّن JWT في localStorage

### Authentication Flow
```
1. POST /api/auth/login (email + password)
2. Server: bcrypt.compare → JWT.sign({ id, role, email }, secret, { expiresIn: "7d" })
3. Client: localStorage.setItem("jwt_token", token)
4. كل طلب: Authorization: Bearer <token>
5. Server: authenticate middleware → jwt.verify → req.user = decoded
6. authorizeRole(["ADMIN"]) → يتحقق من req.user.role
```

### Middleware Stack
```
requestIdMiddleware → securityMiddleware → generalLimiter → payloadSizeLimit
→ express.json → express.urlencoded → static(/uploads) → logging interceptor
→ routes.ts → errorHandler
```

---

## 4. قاعدة البيانات

### جدول المستخدمين (users)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK, DEFAULT RANDOM() | المعرّف الأساسي |
| name | TEXT | NOT NULL | الاسم الكامل |
| email | TEXT | NOT NULL, UNIQUE | البريد الإلكتروني |
| password | TEXT | NOT NULL | كلمة المرور (bcrypt hash) |
| phone | TEXT | nullable | رقم الهاتف |
| role | ENUM | NOT NULL, DEFAULT 'CUSTOMER' | ADMIN/CUSTOMER/STORE_OWNER/DRIVER |
| is_approved | BOOLEAN | NOT NULL, DEFAULT false | هل تمت الموافقة عليه؟ |
| transport_type | TEXT | nullable | نوع مركبة السائق |
| avatar_url | TEXT | nullable | رابط صورة الملف الشخصي |
| drivers_license_url | TEXT | nullable | رابط رخصة القيادة |
| addresses | JSONB | DEFAULT [] | مصفوفة عناوين JSON |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | تاريخ الإنشاء |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | تاريخ آخر تعديل |

### جدول المحافظ (wallets)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| user_id | UUID | NOT NULL, UNIQUE, FK→users.id | المستخدم المالك |
| balance | NUMERIC(12,2) | NOT NULL, DEFAULT '0.00' | الرصيد الحالي |
| created_at | TIMESTAMP | NOT NULL | تاريخ الإنشاء |
| updated_at | TIMESTAMP | NOT NULL | تاريخ التعديل |

### جدول السجل المالي (ledger)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| reference_id | UUID | nullable | معرّف العملية المرتبطة |
| debit_user_id | UUID | FK→users.id | المستخدم المُدان (الخصم) |
| credit_user_id | UUID | FK→users.id | المستخدم الدائن (الإضافة) |
| amount | NUMERIC(12,2) | NOT NULL | المبلغ |
| type | TEXT ENUM | NOT NULL | DEPOSIT/WITHDRAWAL/COMMISSION/REFUND |
| created_at/updated_at | TIMESTAMP | NOT NULL | التواريخ |

### جدول معاملات المحفظة (wallet_transactions)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| wallet_id | UUID | NOT NULL, FK→wallets.id | المحفظة |
| type | ENUM | NOT NULL | DEPOSIT/WITHDRAWAL/REFUND/COMMISSION |
| amount | NUMERIC(12,2) | NOT NULL | المبلغ |
| related_order_id | UUID | nullable | الطلب المرتبط |
| receipt_url | TEXT | nullable | رابط الإيصال |
| notes | TEXT | nullable | ملاحظات |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING/COMPLETED/FAILED |
| created_at | TIMESTAMP | NOT NULL | التاريخ |

### جدول المتاجر (stores)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| owner_id | UUID | NOT NULL, FK→users.id | مالك المتجر |
| name | TEXT | NOT NULL | اسم المتجر |
| type | TEXT | nullable | نوع المتجر (مطعم، بقالة...) |
| description | TEXT | nullable | وصف المتجر |
| location_text | TEXT | nullable | نص الموقع |
| image_url | TEXT | nullable | صورة المتجر |
| created_at/updated_at | TIMESTAMP | NOT NULL | التواريخ |

### جدول المنتجات (products)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| store_id | UUID | NOT NULL, FK→stores.id | المتجر |
| name | TEXT | NOT NULL | اسم المنتج |
| description | TEXT | nullable | الوصف |
| price | NUMERIC(10,2) | NOT NULL | السعر |
| stock | INTEGER | NOT NULL, DEFAULT 0 | الكمية المتاحة |
| category | TEXT | NOT NULL, DEFAULT 'General' | التصنيف |
| image_url | TEXT | nullable | صورة المنتج |
| created_at/updated_at | TIMESTAMP | NOT NULL | التواريخ |

### جدول الطلبات (orders)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| customer_id | UUID | NOT NULL, FK→users.id | العميل |
| overall_status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING/ACCEPTED/IN_TRANSIT/DELIVERED/CANCELLED |
| delivery_status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING/ASSIGNED/PICKED_UP/DELIVERED |
| payment_status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING/PAID/REFUNDED/FAILED |
| total_price | NUMERIC(12,2) | NOT NULL, DEFAULT '0.00' | الإجمالي |
| created_at/updated_at | TIMESTAMP | NOT NULL | التواريخ |

### جدول الطلبات الفرعية (sub_orders)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| order_id | UUID | NOT NULL, FK→orders.id | الطلب الأصلي |
| store_id | UUID | NOT NULL, FK→stores.id | المتجر |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING/ACCEPTED/READY/CANCELLED |
| subtotal | NUMERIC(10,2) | NOT NULL | مجموع هذا المتجر |
| assigned_driver_id | UUID | FK→users.id | السائق المُعيّن |
| expected_delivery_fee | NUMERIC(10,2) | NOT NULL, DEFAULT '0.00' | رسوم التوصيل المتوقعة |
| created_at/updated_at | TIMESTAMP | NOT NULL | التواريخ |

### جدول عناصر الطلب (order_items)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| sub_order_id | UUID | NOT NULL, FK→sub_orders.id | الطلب الفرعي |
| product_id | UUID | NOT NULL, FK→products.id | المنتج |
| quantity | INTEGER | NOT NULL | الكمية |
| price_at_order | NUMERIC(10,2) | NOT NULL | السعر وقت الطلب |

### جدول عروض التوصيل (delivery_offers)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| sub_order_id | UUID | NOT NULL, FK→sub_orders.id | الطلب الفرعي |
| driver_id | UUID | NOT NULL, FK→users.id | السائق |
| offered_fee | NUMERIC(10,2) | NOT NULL | السعر المقترح |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING/ACCEPTED/REJECTED/COUNTERED |
| counter_offered_fee | NUMERIC(10,2) | nullable | السعر المُعاكَس |
| created_at/updated_at | TIMESTAMP | NOT NULL | التواريخ |

### جدول التقييمات (ratings)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| order_id | UUID | NOT NULL, FK→orders.id | الطلب |
| from_user_id | UUID | NOT NULL, FK→users.id | المُقيِّم |
| to_user_id | UUID | NOT NULL, FK→users.id | المُقيَّم |
| rating | INTEGER | NOT NULL | التقييم (1-5) |
| comment | TEXT | nullable | التعليق |
| created_at | TIMESTAMP | NOT NULL | التاريخ |

### جدول OTP التوصيل (delivery_otps)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| order_id | UUID | NOT NULL, FK→orders.id | الطلب |
| sub_order_id | UUID | FK→sub_orders.id | الطلب الفرعي |
| otp_code | TEXT | NOT NULL | الرمز المكوّن من 6 أرقام |
| status | TEXT ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING/VERIFIED/EXPIRED |
| attempt_count | INTEGER | NOT NULL, DEFAULT 0 | عدد محاولات التحقق |
| expires_at | TIMESTAMP | NOT NULL | وقت انتهاء الصلاحية (2 ساعة) |
| created_at/updated_at | TIMESTAMP | NOT NULL | التواريخ |
| **Index** | sub_order_pending_idx | على (sub_order_id, status) | لتسريع البحث |

### جدول طلبات السحب (withdrawal_requests)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| user_id | UUID | NOT NULL, FK→users.id | صاحب الطلب |
| wallet_id | UUID | NOT NULL, FK→wallets.id | المحفظة |
| amount | NUMERIC(12,2) | NOT NULL | المبلغ |
| status | TEXT ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING/APPROVED/REJECTED |
| admin_note | TEXT | nullable | ملاحظة المراجع |
| reviewed_by_admin_id | UUID | FK→users.id | الأدمن المراجع |
| created_at/updated_at | TIMESTAMP | NOT NULL | التواريخ |

### جدول سجلات المراجعة (audit_logs)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| action_type | TEXT | NOT NULL | نوع الإجراء (CREATE/UPDATE/DELETE...) |
| entity_type | TEXT | NOT NULL | نوع الكيان (USER/ORDER/PRODUCT...) |
| entity_id | UUID | NOT NULL | معرّف الكيان |
| performed_by_user_id | UUID | NOT NULL, FK→users.id | منفّذ الإجراء |
| performed_by_role | TEXT | NOT NULL | دور المنفّذ |
| old_value | JSONB | nullable | القيمة القديمة |
| new_value | JSONB | nullable | القيمة الجديدة |
| metadata | JSONB | nullable | بيانات إضافية |
| created_at | TIMESTAMP | NOT NULL | وقت التسجيل |
| **Indexes** | entity_id_idx, performed_by_user_id_idx, created_at_idx, action_type_idx | | |

### جدول الإشعارات (notifications)
| الحقل | النوع | القيود | الوصف |
|-------|-------|--------|-------|
| id | UUID | PK | المعرّف |
| user_id | UUID | NOT NULL, FK→users.id, CASCADE DELETE | المستخدم |
| type | ENUM | NOT NULL | 13 نوع (NEW_ORDER, ACCOUNT_APPROVED...) |
| title | TEXT | NOT NULL | عنوان الإشعار |
| body | TEXT | NOT NULL | محتوى الإشعار |
| data | JSONB | DEFAULT {} | بيانات إضافية للتنقل |
| is_read | BOOLEAN | NOT NULL, DEFAULT false | هل تمت قراءته؟ |
| created_at | TIMESTAMP | NOT NULL | التاريخ |
| **Index** | notifications_user_idx على (user_id, is_read) | | |

### جداول الدردشة
| الجدول | الغرض | الحقول الرئيسية |
|--------|-------|----------------|
| chat_rooms | غرف المحادثة | id, type(ORDER_STORE/ORDER_DRIVER/SUPPORT), reference_id, status |
| chat_participants | المشاركون في كل غرفة | room_id, user_id, last_read_at |
| chat_messages | الرسائل | room_id, sender_id, content, type(TEXT/SYSTEM) |
| support_messages | رسائل الدعم (legacy) | customer_id, sender_role, message |
| push_subscriptions | اشتراكات الإشعارات | user_id, endpoint, p256dh, auth |

### مخطط العلاقات (ERD نصي)

```
users ──(1:1)──► wallets
users ──(1:N)──► stores (ownerId)
users ──(1:N)──► orders (customerId)
users ──(1:N)──► ratings (fromUserId, toUserId)
users ──(1:N)──► audit_logs (performedByUserId)
users ──(1:N)──► notifications
users ──(1:N)──► push_subscriptions
users ──(1:N)──► withdrawal_requests

stores ──(1:N)──► products
stores ──(1:N)──► sub_orders

orders ──(1:N)──► sub_orders
orders ──(1:N)──► delivery_otps
orders ──(1:N)──► ratings

sub_orders ──(1:N)──► order_items
sub_orders ──(1:N)──► delivery_offers
sub_orders ──(1:N)──► delivery_otps
sub_orders ──(M:1)──► users (assignedDriverId)

products ──(1:N)──► order_items

wallets ──(1:N)──► wallet_transactions
wallets ──(1:N)──► withdrawal_requests

ledger ──(M:1)──► users (debitUserId, creditUserId)

chat_rooms ──(1:N)──► chat_participants
chat_rooms ──(1:N)──► chat_messages
users ──(M:N)──► chat_rooms (via chat_participants)
```

---

## 5. المستخدمون داخل النظام

### أنواع المستخدمين وصلاحياتهم

| الصلاحية | ADMIN | CUSTOMER | STORE_OWNER | DRIVER |
|----------|-------|----------|-------------|--------|
| تسجيل الدخول | ✅ | ✅ | ✅ | ✅ |
| موافقة إدارية مطلوبة | ❌ | ❌ | ✅ | ✅ |
| إنشاء طلب | ❌ | ✅ | ❌ | ❌ |
| إلغاء طلب فرعي | ❌ | ✅ | ❌ | ❌ |
| قبول طلب / تحديث حالته | ✅ | ❌ | ✅ | ✅ |
| إدارة المنتجات | ✅ | ❌ | ✅ | ❌ |
| إيداع في المحفظة | ❌ | ✅ | ❌ | ❌ |
| سحب من المحفظة | ❌ | ❌ | ✅ | ✅ |
| تقديم عرض توصيل | ❌ | ❌ | ❌ | ✅ |
| قبول/رفض عروض التوصيل | ❌ | ✅ | ❌ | ❌ |
| توليد OTP | ❌ | ❌ | ❌ | ✅ |
| التحقق من OTP | ❌ | ✅ | ❌ | ❌ |
| مراجعة الإيداعات | ✅ | ❌ | ❌ | ❌ |
| مراجعة السحوبات | ✅ | ❌ | ❌ | ❌ |
| الموافقة على المستخدمين | ✅ | ❌ | ❌ | ❌ |
| إلغاء أي طلب (override) | ✅ | ❌ | ❌ | ❌ |
| عرض سجلات المراجعة | ✅ | ❌ | ❌ | ❌ |
| تعديل رصيد المحفظة يدوياً | ✅ | ❌ | ❌ | ❌ |
| مشاهدة الإحصاءات الكاملة | ✅ | ❌ | ❌ | ❌ |
| الوصول للدردشة | ✅ | ✅ | ✅ | ✅ |

### تفاصيل كل دور

**ADMIN:**
- المستخدم الوحيد المُنشأ يدوياً (لا يمر بالـ Registration العادية)
- يتحكم في الموافقة على STORE_OWNER و DRIVER
- يراجع ويوافق على الإيداعات والسحوبات
- يمكنه إلغاء أي طلب ورد المبلغ للعميل
- لديه لوحة تحكم شاملة مع إحصاءات حقيقية

**CUSTOMER:**
- يُوافَق عليه تلقائياً عند التسجيل
- يُنشئ الطلبات ويدفع من المحفظة
- يتفاوض مع السائقين على رسوم التوصيل
- يُودع أموالاً بإيصال ويطلب مراجعة الأدمن
- يُقيّم الطلبات بعد اكتمالها

**STORE_OWNER:**
- يحتاج موافقة الأدمن
- مُتجره يُنشأ تلقائياً مع حسابه
- يُقبل الطلبات ويُحدّث حالتها (PENDING → ACCEPTED → READY)
- يُدير المنتجات (CRUD كامل)
- يُراقب الأرباح والعمولات
- يُطلب سحب رصيده عند الحاجة

**DRIVER:**
- يحتاج موافقة الأدمن
- يتصفح الطلبات المتاحة ويُقدّم عروض توصيل
- يُفاوض على السعر مع العملاء
- يُولّد OTP لتأكيد الاستلام
- لديه محفظة لاستلام رسوم التوصيل

---

## 6. جميع خصائص النظام الحالية

### ✅ الميزات المكتملة

| الميزة | التفاصيل |
|--------|---------|
| **Authentication** | تسجيل دخول بالبريد أو الهاتف + كلمة مرور (JWT 7 أيام) |
| **Registration** | 3 أنواع أدوار مع حقول إضافية لكل دور (متجر/مركبة) |
| **Role-based Access** | حماية كاملة على Frontend و Backend |
| **Products** | CRUD كامل + صور + مخزون + تصنيفات |
| **Orders** | إنشاء طلبات متعددة المتاجر في عملية واحدة |
| **Sub-orders** | تقسيم الطلب تلقائياً حسب المتجر |
| **Cart** | سلة تسوق محلية (React Context) |
| **Delivery Offers** | نظام تفاوض كامل (عرض → قبول/رفض/عرض مضاد) |
| **OTP Verification** | رمز 6 أرقام، انتهاء 2 ساعة، 5 محاولات كحد أقصى |
| **Wallet System** | محافظ رقمية لكل المستخدمين |
| **Deposit** | إيداع بإيصال + مراجعة الأدمن |
| **Withdrawal** | سحب مباشر + مراجعة الأدمن |
| **Double-entry Ledger** | نظام محاسبة مزدوج (ledger + wallet_transactions) |
| **Ratings** | تقييم 1-5 نجوم مع تعليق |
| **Real-time Chat** | محادثات Socket.IO (عميل↔متجر، عميل↔سائق، دعم↔أدمن) |
| **Notifications (in-app)** | جرس الإشعارات مع عدد غير المقروء |
| **Push Notifications** | Web Push عبر VAPID + Service Worker |
| **Email Notifications** | بريد إلكتروني للأحداث المالية |
| **Audit Logs** | تسجيل كامل لجميع الإجراءات مع redaction للبيانات الحساسة |
| **Admin Dashboard** | إحصاءات حقيقية من قاعدة البيانات |
| **Public Store Pages** | صفحات عامة لاستعراض المتاجر والمنتجات |
| **File Upload** | صور المنتجات، صور المتاجر، صور الأفاتار، إيصالات، رخص القيادة |
| **Rate Limiting** | 6 أنواع مختلفة لحماية نقاط الوصول |
| **Security Headers** | CSP, HSTS, X-Frame-Options, X-XSS-Protection |
| **Admin Wallet Override** | تعديل يدوي للرصيد مع audit trail |
| **Pending Approval UX** | شاشة انتظار للحسابات غير الموافق عليها |
| **DB Backups** | ملفات SQL احتياطية موجودة في مجلد backups/ |
| **Inventory Management** | إدارة المخزون مع قفل FOR UPDATE لمنع overselling |

### ⚠️ الميزات المكتملة جزئياً

| الميزة | ما هو موجود | ما ينقص |
|--------|------------|--------|
| **Maps / Tracking** | حقل location_text نصي فقط | لا يوجد تكامل مع خرائط |
| **Live Tracking** | Socket.IO متاح | لا يوجد tracking للمركبة |
| **Coupons/Discounts** | غير موجود | — |
| **Categories** | حقل category نصي بسيط | لا يوجد جدول categories منفصل |
| **Referral System** | غير موجود | — |
| **Email** | nodemailer مُعدّ | يحتاج SMTP server في الإنتاج |

### ❌ الميزات غير الموجودة

- Coupons / Promo Codes
- Loyalty Points / نقاط الولاء
- Invoices / فواتير PDF
- Analytics / تحليلات متقدمة
- Multi-tenant / SaaS
- Payment Gateway (Stripe/PayPal/Fawry) — الدفع حالياً عبر محفظة داخلية فقط
- Live GPS Tracking
- AI Features
- SMS Notifications

---

## 7. دورة الطلب بالكامل

### المرحلة 1: إنشاء الطلب
```
العميل يضيف منتجات من متاجر متعددة للسلة
     ↓
POST /api/orders مع: customerId + items[] (productId, quantity)
     ↓
order.service.createMultiStoreOrder():
  1. يتحقق من الرصيد الكافي (FOR UPDATE lock)
  2. يتحقق من توفر المخزون
  3. يخصم المبلغ من محفظة العميل
  4. ينشئ parent order
  5. يُجمّع المنتجات حسب المتجر → ينشئ sub_order لكل متجر
  6. ينشئ order_items
  7. يُنشئ chat rooms (ORDER_STORE لكل متجر)
  8. يُرسل إشعار NEW_ORDER لصاحب المتجر
```

### المرحلة 2: قبول الطلب بالمتجر
```
صاحب المتجر يرى الطلب في /store/dashboard/orders
     ↓
PATCH /api/suborders/:id/status { status: "ACCEPTED" }
     ↓
suborder.service.updateSubOrderStatus():
  يُغيّر status → ACCEPTED
  يُرسل إشعار لجميع السائقين المعتمدين (broadcast)
```

### المرحلة 3: تقديم عروض التوصيل
```
السائق يرى الطلب في /driver/tasks
     ↓
POST /api/delivery/suborders/:id/offer { offeredFee: amount }
     ↓
يصل إشعار للعميل بعرض جديد (NEW_OFFER)
```

### المرحلة 4: التفاوض على التوصيل
```
العميل يرى العروض:
  - قبول → ACCEPTED
  - رفض → REJECTED  
  - عرض مضاد → COUNTERED + counter_offered_fee
     ↓
عند القبول: deliveryOffer.service.customerAcceptOffer():
  1. يخصم رسوم التوصيل من محفظة العميل
  2. يُضيف إدخال WITHDRAWAL في ledger
  3. يُعيّن السائق على الطلب الفرعي
  4. يرفض جميع العروض الأخرى
  5. يُنشئ chat room (ORDER_DRIVER)
  6. يُنشئ OTP للتسليم
```

### المرحلة 5: التوصيل
```
السائق يستلم الطلب ويتوجه للعميل
     ↓
السائق ينتقل إلى /driver/active-delivery
     ↓
السائق يُولّد OTP: POST /api/delivery/otp/generate/:orderId
     ↓
العميل يتلقى OTP ويُدخله: POST /api/delivery/otp/verify/:id
     ↓
deliveryOtp.service.verifyOtp():
  1. يتحقق من صحة الرمز (6 أرقام، لم تنته صلاحيته، عدد المحاولات < 5)
  2. يُحدّث status → VERIFIED
  3. يُحدّث sub_order status → DELIVERED
  4. يُعالج العمولة ويُضيف في ledger (COMMISSION)
  5. يُودع رسوم التوصيل في محفظة السائق
  6. يُودع الأرباح في محفظة المتجر
```

### المرحلة 6: الإغلاق والإلغاء

**الإغلاق:** يتم تلقائياً عند DELIVERED بعد التحقق من OTP

**إلغاء بواسطة العميل:**
```
PATCH /api/suborders/:id/cancel
     ↓
suborder.service → يتحقق من إمكانية الإلغاء (PENDING فقط)
يُعيد المبلغ لمحفظة العميل
يُضيف REFUND في ledger
```

**إلغاء بواسطة الأدمن:**
```
PATCH /api/admin/orders/:id/status { status: "CANCELLED" }
     ↓
يُعيد المبلغ الكامل للعميل
يُضيف WITHDRAWAL في ledger
يُرسل إشعار للعميل
```

---

## 8. لوحة التحكم (Admin)

### صفحة Dashboard (/)
- **الإحصاءات:** إجمالي المستخدمين، المتاجر، المنتجات، الطلبات، الطلبات المعلقة/الملغاة/المُسلَّمة، عمولات المنصة
- **مؤشر الصحة:** DB connection, API latency
- **البيانات:** حقيقية من قاعدة البيانات (لا placeholders)

### صفحة المستخدمين (/admin/users)
- عرض جميع المستخدمين (اسم، بريد، دور، حالة الموافقة، تاريخ الانضمام)
- زر الموافقة على DRIVER و STORE_OWNER
- حذف المستخدم مع التحقق من عدم وجود طلبات نشطة

### صفحة المتاجر (/admin/stores)
- عرض جميع المتاجر مع صاحب كل متجر
- إنشاء متجر جديد
- حذف المتجر (cascade delete للمنتجات والطلبات)

### صفحة المنتجات (/admin/products)
- عرض جميع منتجات المنصة
- إدارة المنتجات

### صفحة الطلبات (/admin/orders)
- عرض جميع طلبات المنصة (pagination)
- تغيير حالة أي طلب
- إلغاء الطلبات مع الاسترداد التلقائي

### صفحة الإيداعات (/admin/deposits)
- عرض جميع طلبات الإيداع مع الإيصالات
- زر الموافقة (يُضيف الرصيد + ledger entry)
- زر الرفض

### صفحة السحوبات (/admin/withdrawals)
- عرض طلبات السحب المعلقة
- الموافقة أو الرفض مع إمكانية إضافة ملاحظة

### صفحة الموافقات (/admin/approvals)
- قائمة موحدة لجميع الحسابات المنتظرة الموافقة

### صفحة المالية (/admin/finance)
- تقرير سلامة السجل المالي
- التحقق من توازن الـ ledger

### صفحة سجلات المراجعة (/admin/audit)
- عرض جميع أحداث audit_logs
- فلترة بالنوع، الكيان، التاريخ

---

## 9. تطبيق العميل (Customer)

### الصفحة الرئيسية (/)
- عرض المتاجر المتاحة (grid)
- بطاقات المتاجر مع الصور والأوصاف
- قسم "كيف يعمل"

### صفحة اكتشاف المتاجر (/stores)
- قائمة المتاجر العامة
- البحث والفلترة

### صفحة المتجر العام (/store/:id)
- منتجات المتجر
- إضافة للسلة
- معلومات المتجر

### السلة (/customer/cart)
- عرض المنتجات المضافة
- تعديل الكميات
- تنفيذ الطلب (Checkout)
- الدفع من المحفظة

### الطلبات (/customer/orders)
- قائمة بجميع الطلبات
- حالة كل طلب

### تفاصيل الطلب (/customer/order/:id)
- تفاصيل الطلب الكاملة
- عروض التوصيل (قبول/رفض/عرض مضاد)
- التحقق من OTP لتأكيد الاستلام
- حالة التوصيل

### المحفظة (/customer/wallet)
- عرض الرصيد
- طلب إيداع (رفع إيصال)
- عرض المعاملات

### المعاملات (/customer/transactions)
- سجل كامل بجميع الحركات المالية
- فلترة بالنوع والحالة

### الملف الشخصي (/customer/profile)
- تحديث الاسم والهاتف
- إدارة العناوين
- رفع صورة الملف الشخصي

---

## 10. تطبيق السائق (Driver)

### صفحة المهام (/driver/tasks)
- عرض الطلبات المتاحة للتوصيل (status = ACCEPTED, لم يُعيَّن سائق)
- تقديم عرض سعر
- فلترة حسب المتجر والفئة
- pagination

### صفحة التوصيل النشط (/driver/active-delivery)
- تفاصيل الطلب الحالي
- توليد OTP وإرساله للعميل
- تحديث حالة التوصيل

### صفحة الأرباح (/driver/earnings)
- إجمالي الأرباح
- سجل المعاملات مع فلتر
- عرض الرصيد

### صفحة المحفظة (/driver/wallet)
- عرض الرصيد
- طلب سحب
- سجل المعاملات

### صفحة الملف الشخصي (/driver/profile)
- تحديث البيانات الشخصية
- نوع المركبة
- رفع رخصة القيادة

---

## 11. تطبيق صاحب المتجر (Store Owner)

### لوحة التحكم (/store/dashboard)
- إحصاءات المتجر (طلبات اليوم، الإيرادات، عدد المنتجات)
- الطلبات النشطة
- روابط سريعة

### إدارة الطلبات (/store/dashboard/orders)
- قائمة جميع طلبات المتجر
- تغيير حالة الطلب (PENDING → ACCEPTED → READY)
- عرض تفاصيل الطلب والعناصر

### تفاصيل الطلب (/store/order/:id)
- عناصر الطلب الكاملة مع الأسعار
- بيانات العميل
- تحديث الحالة

### إدارة المنتجات (/store/inventory)
- عرض جميع منتجات المتجر
- إضافة منتج جديد (اسم، وصف، سعر، مخزون، فئة، صورة)
- تعديل منتج
- حذف منتج
- رفع صور المنتجات

### الأرباح (/store/earnings)
- الرصيد الحالي
- سجل المعاملات والعمولات
- طلب سحب

---

## 12. نظام الإشعارات

### كيفية العمل
```
حدث في النظام
    ↓
push.service.notifyUser(userId, notification)
    ↓
1. يُنشئ سجل في جدول notifications (قاعدة البيانات)
2. يُرسل عبر Socket.IO إلى الغرفة user:<userId> (للمتصلين حالياً)
3. يُرسل Web Push Notification عبر VAPID (للمتصفح)
```

### أنواع الإشعارات (13 نوع)

| النوع | المُستَقبِل | الحدث المُطلِق |
|-------|------------|----------------|
| NEW_ORDER | Store Owner | إنشاء طلب جديد |
| ORDER_STATUS_UPDATE | Customer | تغيير حالة الطلب الفرعي |
| NEW_OFFER | Customer | تقديم عرض توصيل |
| OFFER_ACCEPTED | Driver | قبول العميل للعرض |
| OFFER_REJECTED | Driver | رفض العميل للعرض |
| OFFER_COUNTERED | Driver | عرض مضاد من العميل |
| ACCOUNT_APPROVED | Driver/Store Owner | موافقة الأدمن على الحساب |
| DEPOSIT_APPROVED | Customer | موافقة على الإيداع |
| DEPOSIT_REJECTED | Customer | رفض الإيداع |
| WITHDRAWAL_APPROVED | Driver/Store Owner | موافقة على السحب |
| WITHDRAWAL_REJECTED | Driver/Store Owner | رفض السحب |
| WALLET_UPDATE | Any | تغيير في الرصيد |
| SYSTEM_ALERT | Admin | تسجيل سائق/متجر جديد أو إيداع/سحب جديد |

### مكونات الإشعارات
- **NotificationBell:** جرس في جميع navbars مع عداد غير المقروء
- **Service Worker (sw.js):** يستقبل push notifications في الخلفية
- **use-notifications.ts:** hook لإدارة الإشعارات (polling 30s + Socket.IO)

---

## 13. نظام الدفع

### بوابات الدفع المدعومة
| الطريقة | الحالة | التفاصيل |
|---------|--------|---------|
| **Internal Wallet** | ✅ مكتمل | محافظ رقمية داخلية |
| **Cash** | ❌ غير موجود | — |
| **Stripe/PayPal/Fawry** | ❌ غير موجود | — |

### دورة الأموال في النظام

```
العميل يُودع (نقداً خارجياً + إيصال)
    ↓ (موافقة أدمن)
رصيد محفظة العميل يرتفع
    ↓ (عند الطلب)
يُخصم subtotal من محفظة العميل
    ↓ (عند قبول عرض توصيل)
يُخصم delivery_fee من محفظة العميل
    ↓ (عند التسليم OTP)
أرباح المتجر تُضاف لمحفظته (subtotal - commission)
رسوم السائق تُضاف لمحفظته (delivery_fee)
عمولة المنصة تُسجَّل في ledger
```

### نظام الحسابات
- **Precision:** NUMERIC(12,2) لجميع المبالغ
- **Integer Math:** money.ts utility لتجنب أخطاء الفاصلة العائمة
- **Double-entry:** كل حركة مالية تُسجَّل في wallet_transactions + ledger

---

## 14. نظام الخرائط

| الجانب | الحالة |
|--------|--------|
| Google Maps | ❌ غير مدمج |
| OpenStreetMap | ❌ غير مدمج |
| Mapbox | ❌ غير مدمج |
| حساب المسافات | ❌ غير موجود |
| تتبع السائق | ❌ غير موجود |
| الموقع الجغرافي | حقل نصي فقط (location_text) |

---

## 15. جميع API Endpoints

### المصادقة (Auth)
| الطريقة | المسار | الأدوار | الوصف |
|---------|--------|---------|-------|
| POST | `/api/auth/register` | عام | تسجيل مستخدم جديد (CUSTOMER/STORE_OWNER/DRIVER) |
| POST | `/api/auth/login` | عام | تسجيل الدخول (بريد أو هاتف + كلمة مرور) |
| GET | `/api/auth/me` | AUTH | بيانات المستخدم الحالي + رصيد المحفظة |

### الملف الشخصي
| الطريقة | المسار | الأدوار | الوصف |
|---------|--------|---------|-------|
| GET | `/api/customer/profile` | CUSTOMER | تفاصيل ملف العميل |
| PATCH | `/api/customer/profile` | CUSTOMER | تحديث بيانات العميل |
| PATCH | `/api/driver/profile` | DRIVER | تحديث بيانات السائق |
| POST | `/api/profile/avatar` | AUTH | رفع صورة الملف الشخصي |
| POST | `/api/profile/license` | DRIVER | رفع رخصة القيادة |

### المتاجر
| الطريقة | المسار | الأدوار | الوصف |
|---------|--------|---------|-------|
| GET | `/api/public/stores` | عام | قائمة المتاجر العامة |
| GET | `/api/public/stores/:id` | عام | تفاصيل متجر عام |
| GET | `/api/stores` | ADMIN/STORE_OWNER | قائمة المتاجر (المصادق عليه يرى متجره) |
| POST | `/api/stores` | ADMIN/STORE_OWNER | إنشاء متجر |
| DELETE | `/api/stores/:id` | ADMIN | حذف متجر |
| POST | `/api/stores/:id/image` | STORE_OWNER/ADMIN | رفع صورة المتجر |

### المنتجات
| الطريقة | المسار | الأدوار | الوصف |
|---------|--------|---------|-------|
| GET | `/api/products` | عام | قائمة المنتجات (مع ?store_id= للفلترة) |
| POST | `/api/products` | STORE_OWNER/ADMIN | إنشاء منتج |
| GET | `/api/products/:id` | عام | تفاصيل منتج |
| PATCH | `/api/products/:id` | STORE_OWNER/ADMIN | تحديث منتج |
| DELETE | `/api/products/:id` | STORE_OWNER/ADMIN | حذف منتج |
| POST | `/api/products/:id/image` | STORE_OWNER/ADMIN | رفع صورة منتج |

### الطلبات
| الطريقة | المسار | الأدوار | الوصف |
|---------|--------|---------|-------|
| GET | `/api/orders` | AUTH | طلبات المستخدم الحالي |
| GET | `/api/orders/my-orders` | AUTH | نفس السابق (alias) |
| GET | `/api/orders/my-store` | STORE_OWNER/ADMIN | طلبات متجر الأدمن/المالك |
| GET | `/api/orders/:id` | AUTH | تفاصيل طلب |
| POST | `/api/orders` | CUSTOMER | إنشاء طلب جديد |
| PATCH | `/api/suborders/:id/status` | STORE_OWNER/DRIVER/ADMIN | تحديث حالة طلب فرعي |
| PATCH | `/api/suborders/:id/cancel` | CUSTOMER | إلغاء طلب فرعي |

### التوصيل
| الطريقة | المسار | الأدوار | الوصف |
|---------|--------|---------|-------|
| GET | `/api/delivery/available-tasks` | DRIVER | المهام المتاحة للتوصيل |
| GET | `/api/delivery/available-order-tasks` | DRIVER | المهام مجمّعة بالطلب |
| GET | `/api/suborders/active` | DRIVER | التوصيل النشط الحالي |
| POST | `/api/delivery/otp/generate/:id` | DRIVER | توليد OTP للتسليم |
| POST | `/api/delivery/otp/verify/:id` | DRIVER | التحقق من OTP |

### عروض التوصيل
| الطريقة | المسار | الأدوار | الوصف |
|---------|--------|---------|-------|
| POST | `/api/delivery/suborders/:id/offer` | DRIVER | تقديم عرض على طلب فرعي |
| POST | `/api/delivery/orders/:orderId/offer` | DRIVER | تقديم عرض على طلب كامل |
| GET | `/api/delivery/suborders/:id/offers` | CUSTOMER | عروض طلب فرعي |
| GET | `/api/delivery/orders/:orderId/offers` | CUSTOMER | عروض طلب كامل |
| POST | `/api/delivery/offers/:offerId/accept` | CUSTOMER | قبول عرض |
| POST | `/api/delivery/offers/:offerId/reject` | CUSTOMER | رفض عرض |
| POST | `/api/delivery/offers/:offerId/counter` | CUSTOMER | عرض مضاد |
| POST | `/api/delivery/offers/:offerId/accept-counter` | DRIVER | قبول العرض المضاد |
| POST | `/api/delivery/orders/:orderId/offers/accept` | CUSTOMER | قبول عرض على طلب كامل |
| POST | `/api/delivery/orders/:orderId/offers/reject` | CUSTOMER | رفض عرض على طلب كامل |
| POST | `/api/delivery/orders/:orderId/offers/counter` | CUSTOMER | عرض مضاد على طلب كامل |
| POST | `/api/delivery/orders/:orderId/offers/accept-counter` | DRIVER | قبول العرض المضاد على طلب كامل |

### المحفظة والمالية
| الطريقة | المسار | الأدوار | الوصف |
|---------|--------|---------|-------|
| GET | `/api/wallet` | AUTH | رصيد المحفظة |
| GET | `/api/wallet/pending` | AUTH | المعاملات المعلقة |
| POST | `/api/wallet/deposit` | CUSTOMER | طلب إيداع |
| POST | `/api/wallet/deposit/receipt` | CUSTOMER | رفع إيصال الإيداع |
| POST | `/api/wallet/withdraw` | DRIVER/STORE_OWNER | طلب سحب |
| PATCH | `/api/admin/wallets/:walletId/override` | ADMIN | تعديل رصيد يدوي |
| GET | `/api/ledger/transactions` | AUTH | سجل الحركات المالية |
| GET | `/api/admin/withdrawals/pending` | ADMIN | طلبات السحب المعلقة |
| POST | `/api/admin/withdrawals/:id/approve` | ADMIN | موافقة على سحب |
| POST | `/api/admin/withdrawals/:id/reject` | ADMIN | رفض سحب |

### الإشعارات
| الطريقة | المسار | الأدوار | الوصف |
|---------|--------|---------|-------|
| GET | `/api/notifications` | AUTH | قائمة إشعارات المستخدم |
| PATCH | `/api/notifications/:id/read` | AUTH | تمييز إشعار كمقروء |
| POST | `/api/notifications/push/subscribe` | AUTH | تسجيل Push Subscription |
| DELETE | `/api/notifications/push/unsubscribe` | AUTH | إلغاء Push Subscription |

### الدردشة
| الطريقة | المسار | الأدوار | الوصف |
|---------|--------|---------|-------|
| GET | `/api/chat/rooms` | AUTH | قائمة غرف المحادثة |
| GET | `/api/chat/rooms/:roomId/messages` | AUTH | رسائل غرفة |
| POST | `/api/chat/rooms/:roomId/messages` | AUTH | إرسال رسالة |
| POST | `/api/chat/rooms/:roomId/read` | AUTH | تمييز الرسائل كمقروءة |
| POST | `/api/chat/support` | AUTH | فتح غرفة دعم |
| GET | `/api/chat/unread` | AUTH | عدد الرسائل غير المقروءة |

### الإدارة
| الطريقة | المسار | الأدوار | الوصف |
|---------|--------|---------|-------|
| GET | `/api/admin/stats` | ADMIN | إحصاءات لوحة التحكم |
| GET | `/api/admin/orders` | ADMIN | جميع طلبات المنصة |
| PATCH | `/api/admin/orders/:id/status` | ADMIN | تغيير حالة أي طلب |
| GET | `/api/users` | ADMIN | قائمة جميع المستخدمين |
| DELETE | `/api/admin/users/:id` | ADMIN | حذف مستخدم |
| PATCH | `/api/admin/users/:id/approve` | ADMIN | الموافقة على مستخدم |
| GET | `/api/admin/audit` | ADMIN | سجلات المراجعة |
| GET | `/api/admin/health` | ADMIN | فحص صحة النظام |
| GET | `/api/health` | عام | فحص صحة بسيط |
| GET | `/api/admin/reports/stats` | ADMIN | تقارير إحصائية |

---

## 16. الأمان

### المصادقة والتفويض
| الجانب | التطبيق |
|--------|---------|
| Hashing | bcryptjs (salt rounds افتراضية) |
| Token | JWT مع secret يُقرأ من env (إلزامي، يوقف الخادم إن غاب) |
| مدة الجلسة | 7 أيام |
| انتهاء الجلسة | TOKEN_EXPIRED code يُعيده الخادم |
| RBAC | authorizeRole middleware على كل route |

### Security Headers
| الـ Header | القيمة |
|-----------|-------|
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| X-XSS-Protection | 1; mode=block |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=() |
| HSTS (prod) | max-age=31536000; includeSubDomains |
| CSP (prod) | script-src 'self'; style-src 'self' unsafe-inline |

### Rate Limiting
| الـ Limiter | الحد | النافذة |
|-------------|-----|--------|
| generalLimiter | 1000 طلب | 15 دقيقة |
| loginLimiter | 30 محاولة | 15 دقيقة |
| registerLimiter | 10 مرات | ساعة (معطل في dev) |
| withdrawLimiter | 5 طلبات | 24 ساعة |
| otpLimiter | 5 محاولات | 5 دقائق |
| orderLimiter | 20 طلب | 10 دقائق |
| depositLimiter | 10 طلبات | ساعة |

### Validation
- جميع المدخلات تُتحقق منها بـ Zod
- UUID validation قبل استعلامات DB
- Payload size limit: 10MB

### إدارة الأسرار
- JWT_SECRET مطلوب من env (خطأ فادح إن غاب)
- VAPID keys من env
- DATABASE_URL من env

### أمان إضافي
- Sensitive data redaction في audit logs (password, token, otp, credit_card)
- `trust proxy: 1` للحصول على الـ IP الصحيح خلف reverse proxy
- `_isRedirecting` guard لمنع redirect متعدد عند 401

---

## 17. الأداء

### نقاط القوة
- **Connection Pooling:** max 20 اتصال، timeout 5s
- **Indexed Queries:** فهارس على audit_logs (4 حقول)، notifications، chat
- **Pagination:** في الطلبات، السجل المالي، المهام
- **Money Utility:** عمليات حسابية بالأعداد الصحيحة لتجنب أخطاء الفاصلة العائمة
- **Batched N+1 Fix:** `getCustomerOrders` يجلب الطلبات بـ batch بدلاً من استعلام لكل طلب

### مشكلات الأداء المحتملة
1. **لا يوجد Redis/Caching:** كل طلب يصل لقاعدة البيانات
2. **`orders` endpoint بدون pagination بشكل افتراضي:** المستخدم يحصل على 20 طلب فقط
3. **رفع الملفات محلياً:** ملفات uploads/ على نفس الخادم (لا CDN)
4. **Socket.IO بدون adapter:** في حالة multi-instance سينكسر
5. **`getStores()` يجلب جميع المتاجر بدون pagination**

---

## 18. جودة الكود

### نقاط القوة
- TypeScript صارم مع typed DTOs
- تقسيم وحدات (Feature Modules)
- Service Layer منفصل عن Controller
- Shared schema بين Frontend و Backend
- معالجة شاملة للأخطاء
- Audit logging تلقائي للعمليات الحساسة
- تعليقات Q&A مفصّلة تشرح قرارات التصميم

### Code Smells / Technical Debt

| المشكلة | الخطورة | الموقع |
|---------|---------|--------|
| routes.ts بـ 1200+ سطر | متوسط | server/routes.ts |
| `support_messages` جدول legacy غير مستخدم فعلياً | منخفض | schema.ts |
| بعض الحقول nullable بدون سبب واضح | منخفض | متعدد |
| لا يوجد Unit Tests شاملة (توجد spec files جزئية فقط) | عالٍ | server/modules/*/spec.ts |
| Cart state يُفقد عند تحديث الصفحة (localStorage) | متوسط | client |
| تكرار منطق authentication check في بعض الصفحات | منخفض | client/src/pages |

### Dead Code
- `admin_dashboard_report.json`, `admin_report.md` وملفات JSON كثيرة في الجذر (artifacts من جلسات debugging)
- `logs/` تحتوي ملفات JSON من جلسات سابقة

---

## 19. قابلية التوسع

### SaaS
**الحالة:** ❌ غير مهيّأ  
**السبب:** لا يوجد multi-tenancy، لا tenant_id في الجداول، لا منطق عزل البيانات بين عملاء مختلفين. المشروع يدير منصة واحدة فقط.

**ما يلزم:** إضافة tenant_id لجميع الجداول، نظام Billing/Subscriptions، عزل البيانات.

### White Label
**الحالة:** ⚠️ ممكن جزئياً  
**السبب:** الكود غير مقترن بعلامة تجارية محددة. يمكن تغيير الاسم والألوان بسهولة في CSS/i18n. لكن لا يوجد نظام تهيئة ديناميكي للعلامة التجارية.

### Marketplace
**الحالة:** ✅ هذا ما هو عليه المشروع بالفعل  
**السبب:** يدعم متاجر متعددة، بائعين متعددين، سائقين متعددين، مع نظام عمولات.

### Multi-Tenant
**الحالة:** ❌ غير مهيّأ  
**السبب:** نفس أسباب SaaS.

---

## 20. جاهزية المشروع (التقييم من 100)

| المعيار | الدرجة | التوضيح |
|---------|--------|---------|
| **البنية (Architecture)** | 72/100 | جيدة لكن routes.ts ضخم جداً، يحتاج تقسيم |
| **الأمان (Security)** | 78/100 | JWT, RBAC, headers جيدة. ينقص: CSRF protection على بعض forms، لا blacklist للـ tokens |
| **الأداء (Performance)** | 60/100 | لا caching، ملفات محلية، بعض queries بدون pagination |
| **التنظيم (Code Quality)** | 70/100 | TypeScript جيد، modules واضحة، routes.ts تحتاج تقسيم |
| **التوسع (Scalability)** | 45/100 | Monolithic بدون Redis، Storage محلي، Socket.IO بدون adapter |
| **سهولة الصيانة** | 68/100 | تعليقات جيدة، Q&A مفصّلة، لكن tests ضعيفة |
| **المجموع** | **65.5/100** | مشروع MVP ناضج جيد، يحتاج تحسين للإنتاج |

---

## 21. ما الذي ينقص المشروع؟

### 🔴 Critical (حرج)
1. **لا يوجد دفع إلكتروني حقيقي** — الإيداع يدوي بإيصال، لا Stripe/Fawry/PayPal
2. **لا يوجد Redis / Caching** — كل طلب يضرب DB، سيُشكّل bottleneck عند Scale
3. **رفع الملفات محلياً** — uploads/ ستُفقد عند إعادة نشر الخادم (يلزم S3/Cloudinary)
4. **لا يوجد JWT blacklist/revocation** — لا يمكن إلغاء session حتى قبل انتهاء 7 أيام

### 🟠 High (عالي)
5. **لا يوجد خرائط/GPS** — رسوم التوصيل تُقدَّر يدوياً بدون مسافة حقيقية
6. **Tests غير كافية** — spec files جزئية، لا integration tests شاملة
7. **لا يوجد Refresh Token** — بعد 7 أيام يُجبَر المستخدم على re-login
8. **Socket.IO بدون Redis Adapter** — لا يعمل في multi-instance deployment
9. **Cart تُفقد عند تسجيل الخروج** — لا persistence في DB للسلة

### 🟡 Medium (متوسط)
10. **لا يوجد نظام Category للمتاجر** — التصنيف نصي بسيط
11. **لا يوجد Coupons/Discounts**
12. **لا يوجد Loyalty Points**
13. **لا يوجد Email verification** — عند التسجيل
14. **لا يوجد SMS Notifications** — Nodemailer فقط (بريد)
15. **Admin لا يمكنه CRUD كامل للمستخدمين** (تعديل البيانات)

### 🔵 Low (منخفض)
16. **لا يوجد فواتير PDF قابلة للتحميل**
17. **لا يوجد Advanced Analytics Dashboard**
18. **لا يوجد Referral System**
19. **لا يوجد System Settings Page** (commission rate, etc.)
20. **لا يوجد نظام نسخ احتياطي تلقائي** (backups/ يدوية فقط)

---

## 22. الاستخدام التجاري

### من يمكنه شراء هذا المشروع؟
- **شركات التوصيل المحلية** تريد منصتها الخاصة
- **سوبر ماركت / بقالة** تريد تطبيق توصيل خاص
- **مطاعم** تريد نظام طلبات مع سائقين مستقلين
- **متاجر إلكترونية** تريد بنية تحتية جاهزة

### القطاعات المناسبة
- التجزئة الإلكترونية (Q-Commerce)
- توصيل الطعام
- توصيل البقالة
- Gig Economy (سائقين مستقلين)
- التجارة المحلية Hyperlocal

### كيف يمكن بيعه؟
| طريقة البيع | التفاصيل |
|------------|---------|
| **Source Code** | بيع الكود مرة واحدة لعميل واحد |
| **White Label** | تخصيص بالعلامة التجارية للعميل |
| **SaaS** | يتطلب إعادة هيكلة multi-tenant |
| **Marketplace** | هو marketplace بالفعل |

---

## 23. التقرير النهائي (Executive Summary)

### ملخص تنفيذي
"مع جابر" هو منصة hyperlocal marketplace متكاملة تربط عملاء بمتاجر محلية وسائقين مستقلين. المشروع مبني على تقنيات حديثة (React 18 + Express 5 + PostgreSQL + Socket.IO) مع معمارية modular واضحة وسيستم مالي مزدوج القيد محترف.

### نقاط القوة
- ✅ نظام أدوار متكامل (4 أدوار)
- ✅ سيستم مالي مزدوج القيد مع ledger
- ✅ محادثات فورية (Socket.IO)
- ✅ إشعارات Web Push + In-App
- ✅ نظام تفاوض للتوصيل (Negotiation)
- ✅ OTP للتأكيد من الاستلام
- ✅ Audit logging شامل
- ✅ Security جيد (headers + rate limiting + JWT)
- ✅ واجهة عربية كاملة (RTL)
- ✅ معمارية TypeScript صارمة

### نقاط الضعف
- ❌ لا دفع إلكتروني (Stripe/Fawry)
- ❌ Storage محلي (غير مستدام)
- ❌ لا خرائط/GPS
- ❌ لا Redis/Caching
- ❌ Tests محدودة
- ❌ routes.ts ضخم جداً

### الفرص
- إضافة payment gateway → تحويل لسوق فعلي
- إضافة GPS tracking → تجربة أفضل للسائق والعميل
- تحويل لـ SaaS → بيع كخدمة لمتاجر متعددة
- إضافة mobile app (React Native)

### المخاطر
- فقدان الملفات عند إعادة النشر (uploads محلية)
- عدم قابلية التوسع الأفقي (بدون Redis)
- لا توجد طريقة لإلغاء JWT قبل انتهاء صلاحيته

### SWOT Analysis

```
STRENGTHS (نقاط القوة)          WEAKNESSES (نقاط الضعف)
━━━━━━━━━━━━━━━━━━━━━━━━━━    ━━━━━━━━━━━━━━━━━━━━━━━━━━
• نظام مالي محترف                • لا دفع إلكتروني حقيقي
• Real-time communications       • Storage محلي
• Security متقدم                 • لا خرائط/GPS
• Multi-role system              • Tests محدودة
• واجهة عربية متكاملة            • Monolithic architecture
• Audit trail شامل               • routes.ts ضخم

OPPORTUNITIES (الفرص)           THREATS (المخاطر)
━━━━━━━━━━━━━━━━━━━━━━━━━━    ━━━━━━━━━━━━━━━━━━━━━━━━━━
• إضافة payment gateway          • منافسة منصات كبيرة (Talabat, Noon)
• تحويل لـ SaaS/White Label     • فقدان data عند تعطل الخادم
• Mobile app (React Native)     • JWT tokens غير قابلة للإلغاء
• GPS tracking                  • Scale محدود بدون Redis
• Loyalty/Coupons system        • vendor lock-in على Replit
```

---

## 24. جدول Current Project Status

| الميزة | الحالة | نسبة الإنجاز |
|--------|--------|------------|
| **Authentication (JWT + RBAC)** | ✔ مكتمل | 95% |
| **Registration (Multi-role)** | ✔ مكتمل | 90% |
| **Products (CRUD + Images)** | ✔ مكتمل | 90% |
| **Multi-Store Orders** | ✔ مكتمل | 85% |
| **Delivery Offers (Negotiation)** | ✔ مكتمل | 85% |
| **OTP Verification** | ✔ مكتمل | 90% |
| **Wallet System** | ✔ مكتمل | 90% |
| **Double-entry Ledger** | ✔ مكتمل | 85% |
| **Real-time Chat (Socket.IO)** | ✔ مكتمل | 80% |
| **Push Notifications (VAPID)** | ✔ مكتمل | 80% |
| **In-App Notifications** | ✔ مكتمل | 85% |
| **Email Notifications** | ⚠ مكتمل جزئياً | 60% (يحتاج SMTP config) |
| **Admin Dashboard** | ✔ مكتمل | 85% |
| **Audit Logs** | ✔ مكتمل | 90% |
| **File Upload (Images)** | ✔ مكتمل | 75% (storage محلي) |
| **Arabic UI (RTL)** | ✔ مكتمل | 90% |
| **Rate Limiting** | ✔ مكتمل | 90% |
| **Security Headers** | ✔ مكتمل | 85% |
| **Ratings/Reviews** | ⚠ مكتمل جزئياً | 50% (DB schema موجود، UI محدود) |
| **Public Store Pages** | ✔ مكتمل | 85% |
| **Cart** | ✔ مكتمل | 80% |
| **Inventory Management** | ✔ مكتمل | 80% |
| **Admin Approval Flow** | ✔ مكتمل | 90% |
| **Deposit/Withdrawal Flow** | ✔ مكتمل | 90% |
| **Coupons/Discounts** | ❌ غير موجود | 0% |
| **Loyalty Points** | ❌ غير موجود | 0% |
| **Maps/GPS Tracking** | ❌ غير موجود | 0% |
| **Payment Gateway** | ❌ غير موجود | 0% |
| **SMS Notifications** | ❌ غير موجود | 0% |
| **PDF Invoices** | ❌ غير موجود | 0% |
| **Advanced Analytics** | ❌ غير موجود | 0% |
| **Referral System** | ❌ غير موجود | 0% |
| **Multi-tenant/SaaS** | ❌ غير موجود | 0% |
| **Redis/Caching** | ❌ غير موجود | 0% |
| **CDN File Storage** | ❌ غير موجود | 0% |
| **Unit/Integration Tests** | ⚠ مكتمل جزئياً | 20% |
| **Email Verification** | ❌ غير موجود | 0% |
| **Mobile App** | ❌ غير موجود | 0% |

---

*انتهى التقرير — تاريخ الإعداد: 26 يونيو 2026*  
*هذه وثيقة قراءة فقط — لم يُعدَّل أي ملف أثناء إعدادها*
