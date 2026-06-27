# 02 — Architecture Principles
**المبادئ المعمارية الأساسية للمشروع**

---

## المعمارية المعتمدة: Modular Monolith

### لماذا هذا الاختيار؟
المشروع بُني كـ **Modular Monolith** — ليس Microservices، وليس Spaghetti Monolith:

- **ليس Microservices** لأن: الفريق صغير، التعقيد العملياتي مرتفع، الكود يتشارك schema.ts
- **ليس Spaghetti** لأن: كل module مستقل بـ controller/service/router خاص
- **Modular Monolith** لأنه: سهل النشر، يدعم التطور نحو Microservices مستقبلاً دون إعادة بناء

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT LAYER                      │
│   React 18 + Vite │ Wouter │ TanStack Query v5      │
│   shadcn/ui │ Tailwind CSS 4 │ Socket.IO client     │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP + WebSocket
┌──────────────────────▼──────────────────────────────┐
│                   SERVER LAYER                       │
│   Express 5 │ JWT Auth │ RBAC Middleware            │
│   Rate Limiting │ Security Headers │ File Upload    │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │   AUTH   │ │  WALLET  │ │  ORDERS  │  ...        │
│  │ router   │ │ router   │ │ router   │            │
│  │controller│ │controller│ │controller│            │
│  │ service  │ │ service  │ │ service  │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                   DATA LAYER                         │
│   Drizzle ORM │ PostgreSQL │ Redis │ S3 Storage     │
└─────────────────────────────────────────────────────┘
```

---

## حدود الطبقات (Layer Boundaries)

### طبقة العميل (Client Layer)
**مسموح:**
- عرض البيانات التي يُعيدها الـ API
- إدارة Local UI State (loading, modals, form state)
- Cache البيانات عبر TanStack Query
- الـ Routing بين الصفحات

**ممنوع:**
- ❌ أي business logic (سعر، عمولة، حالات الطلب)
- ❌ قراءة DB مباشرة
- ❌ تخزين secrets أو JWT في أماكن غير آمنة
- ❌ حسابات مالية (المبلغ، الخصم، الرصيد) — هذا دور الـ server

### طبقة الـ Router
**مسموح:**
- تعريف HTTP method + path
- تطبيق Middleware (authenticate، authorize، rateLimiter)
- استدعاء Controller

**ممنوع:**
- ❌ Business logic
- ❌ DB queries
- ❌ Response formatting خارج نطاق HTTP status codes

### طبقة الـ Controller
**مسموح:**
- استقبال الـ Request
- Validation بـ Zod
- استدعاء Service
- تشكيل Response

**ممنوع:**
- ❌ Business logic معقدة (تذهب للـ Service)
- ❌ DB queries مباشرة (تذهب للـ Storage)
- ❌ إرسال Notifications مباشرة (تذهب للـ PushService)

### طبقة الـ Service
**مسموح:**
- Business logic كاملة
- استدعاء Storage
- استدعاء external services (Push, Email, S3)
- DB transactions عبر `db.transaction()`

**ممنوع:**
- ❌ الوصول لـ `req` أو `res` مباشرة
- ❌ HTTP status codes
- ❌ إرسال HTTP responses

### طبقة الـ Storage (IStorage)
**مسموح:**
- CRUD operations على DB
- Drizzle ORM queries
- SQL aggregations

**ممنوع:**
- ❌ Business logic
- ❌ HTTP context
- ❌ External API calls

---

## فصل المسؤوليات (Separation of Concerns)

```
HTTP Concerns     → Controller
Business Rules    → Service
Data Access       → Storage
UI Rendering      → React Components
Data Fetching     → TanStack Query hooks
Shared Types      → shared/schema.ts
Utilities         → server/utils/ أو client/src/lib/
```

---

## منع الـ Coupling الزائد

### قاعدة: Dependency flows downward only
```
Router → Controller → Service → Storage → DB
                              ↗
                    لا شيء يستدعي طبقة أعلى منه
```

### قاعدة: Services لا تستدعي بعضها مباشرة
```typescript
// ❌ ممنوع: WalletService تستدعي OrderService
class WalletService {
  constructor(private orderService: OrderService) {} // ❌
}

// ✅ المقبول: كلاهما يستخدم Storage مباشرة
// أو: استخدام Events/Callbacks للـ cross-service communication
```

### استثناء مقبول: PushService و AuditService
```typescript
// ✅ يُسمح للـ services باستدعاء PushService و AuditService
// لأنهما Cross-cutting concerns
class OrderService {
  constructor(
    private storage: IStorage,
    private pushService: PushService,    // ✅ مقبول
    private auditService: AuditService,  // ✅ مقبول
  ) {}
}
```

---

## الحفاظ على Modularity

### قاعدة Module Independence
كل module في `server/modules/<feature>/` يجب أن يكون قادراً على:
1. الفهم بشكل مستقل (لا references خفية لـ modules أخرى)
2. الاختبار بشكل مستقل (mock dependencies واضحة)
3. الاستبدال دون كسر modules أخرى

### قاعدة Shared Logic
```
إذا احتاج module-A و module-B نفس الـ logic:
  → استخرج لـ server/utils/
  → أو shared/schema.ts
  → لا تضع في أحدهما وتستورد من الآخر
```

---

## التعامل مع Feature Growth

### إضافة Feature جديدة
```
1. أنشئ مجلداً جديداً: server/modules/<feature>/
2. اتبع نفس الهيكل: router, controller, service
3. سجّل في server/routes.ts (mount only)
4. لا تعدّل modules أخرى إلا إذا كان ضرورياً
5. Document الـ API في Swagger
```

### متى تقسم module موجود؟
```
إذا تجاوز الـ service 300 سطر → انظر إذا كان يحمل مسؤوليتين
إذا تجاوز الـ controller 150 سطر → قسّم الـ actions
إذا تجاوز الـ router 80 سطر → قسّم لـ sub-routers
```

---

## القواعد الإلزامية

```
✦ ARCH-01: لا منطق تجاري داخل Controllers أو Routes
✦ ARCH-02: لا DB queries مباشرة خارج Storage layer
✦ ARCH-03: لا استيراد من module لـ module آخر مباشرة (عبر Storage فقط)
✦ ARCH-04: لا HTTP context (req/res) داخل Services
✦ ARCH-05: كل Feature جديدة في مجلدها المستقل
✦ ARCH-06: shared/schema.ts هو المصدر الوحيد للـ types
✦ ARCH-07: لا "shortcuts مؤقتة" تكسر هذه الحدود — أي استثناء موثق في PR
✦ ARCH-08: Business logic المالية (wallet, ledger) لا تُكتب إلا في wallet.service.ts
✦ ARCH-09: DB transactions تُستخدم لأي عملية تمس أكثر من جدول
✦ ARCH-10: الـ Socket.IO events لا تحتوي business logic — تستدعي services
```
