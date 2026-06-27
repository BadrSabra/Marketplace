# 14 — Performance Budget
**ميزانيات الأداء وحدودها الإلزامية**

---

## الحدود الإلزامية

```
┌─────────────────────────────────────────────────────────────┐
│                   PERFORMANCE BUDGET                         │
│                                                              │
│  API Response Time:                                          │
│    p50  < 100ms   (النصف الأسرع)                            │
│    p95  < 500ms   (95% من الطلبات)                          │
│    p99  < 2000ms  (99% من الطلبات)                          │
│    Max  < 5000ms  (أي طلب يتجاوز → تحقيق فوري)             │
│                                                              │
│  Frontend (Lighthouse):                                      │
│    LCP  < 2.5s    (Largest Contentful Paint)                │
│    FID  < 100ms   (First Input Delay)                       │
│    CLS  < 0.1     (Cumulative Layout Shift)                 │
│    TBT  < 200ms   (Total Blocking Time)                     │
│    Performance Score ≥ 85                                   │
│                                                              │
│  DB Queries:                                                 │
│    Simple query    < 10ms                                    │
│    Complex JOIN    < 50ms                                    │
│    Aggregation     < 100ms                                   │
│    ANY query > 500ms → Index review مطلوب                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. API Performance Targets

| Endpoint | Target p95 | الحالة الحالية | الإجراء |
|---------|-----------|---------------|---------|
| GET /api/public/stores | < 200ms | غير مقاس | Add Redis cache |
| GET /api/public/stores/:id/products | < 200ms | غير مقاس | Add Redis cache |
| GET /api/orders | < 300ms | غير مقاس | Add pagination + index |
| POST /api/orders | < 500ms | غير مقاس | DB transaction مضمون |
| GET /api/wallet | < 150ms | غير مقاس | Add Redis cache (30s) |
| POST /api/auth/login | < 300ms | غير مقاس | bcrypt أبطأ عمداً |
| GET /api/admin/stats | < 500ms | غير مقاس | Materialized view (مستقبل) |
| Socket.IO message latency | < 50ms | غير مقاس | Redis adapter مطلوب |

---

## 2. DB Query Performance

### Rules
```
✅ كل query يُشرح بـ EXPLAIN ANALYZE قبل إضافة index جديد
✅ لا SELECT * — حدد الأعمدة المطلوبة
✅ لا N+1 queries — استخدم JOIN أو batch
✅ لا loop على DB queries في business logic
✅ LIMIT إلزامي على كل query تُعيد قوائم
✅ Indexes على columns تُستخدم في WHERE أو JOIN

الفحص الأسبوعي:
  pg_stat_statements → أبطأ 10 queries
  pg_stat_user_tables → sequential scans مرتفعة؟
```

### N+1 Pattern المحظور
```typescript
// ❌ N+1: query لكل طلب
const orders = await storage.getOrders();
for (const order of orders) {
  order.subOrders = await storage.getSubOrders(order.id); // ← N queries
}

// ✅ JOIN واحد
const ordersWithSubs = await db
  .select()
  .from(orders)
  .leftJoin(subOrders, eq(subOrders.orderId, orders.id))
  .where(eq(orders.customerId, customerId));
```

---

## 3. Caching Strategy

```typescript
// طبقات الـ Cache:
// L1: TanStack Query (client — staleTime)
// L2: Redis (server — TTLs)
// L3: PostgreSQL query cache (تلقائي)

// Cache TTL Policy:
STORES_LIST       = 2 * 60;    // دقيقتان (يتغير بشكل متكرر)
STORE_DETAILS     = 5 * 60;    // 5 دقائق
PRODUCTS_LIST     = 5 * 60;    // 5 دقائق
WALLET_BALANCE    = 30;        // 30 ثانية (حساس)
ADMIN_STATS       = 60 * 60;   // ساعة (للإحصائيات)
NOTIFICATIONS     = 30;        // 30 ثانية
PUBLIC_CATEGORIES = 24 * 60 * 60; // 24 ساعة

// Cache Invalidation: عند أي mutation تمس البيانات
// مثال: deleteProduct → حذف cache المنتجات لهذا المتجر
await redis.del(`products:store:${storeId}`);
```

---

## 4. Frontend Performance

```typescript
// Code Splitting: كل Role في chunk منفصل
// App.tsx يستخدم lazy imports:
const AdminDashboard = lazy(() => import("./pages/admin/dashboard"));
const CustomerHome = lazy(() => import("./pages/customer/home"));
const DriverTasks = lazy(() => import("./pages/driver/tasks"));
const StoreDashboard = lazy(() => import("./pages/store/dashboard"));

// Image Optimization:
// - WebP تلقائياً عبر S3 + CloudFront
// - Lazy loading: loading="lazy" على كل <img>
// - Max sizes: أيقونات 64px، صور المنتجات 800px، بانرات 1200px

// Bundle Budget:
// JS bundle (initial): < 200KB gzipped
// JS bundle (per route): < 100KB gzipped
// CSS: < 50KB gzipped
```

---

## 5. Load Expectations

```
الحالي (Pre-launch): < 100 concurrent users
Target v1.0:         500 concurrent users
Target v1.5:         2,000 concurrent users
Target v2.0 (SaaS):  10,000 concurrent users (distributed)

الاختبار قبل كل release:
  Artillery: 500 concurrent users × 5 دقائق
  معيار النجاح: p99 < 2s، Error rate < 1%
```

---

## 6. Background Jobs

```typescript
// Rules للـ Background Jobs:
// ✅ لا عمليات ثقيلة في HTTP request → background job بدلاً
// ✅ كل job له timeout محدد
// ✅ كل job له retry policy
// ✅ فشل الـ job لا يُخفَق في silence

// أمثلة:
POST /api/orders → يُنشئ الطلب فوراً → job للإشعار في الخلفية
PATCH /api/deposits/approve → يُعالج فوراً → email receipt في الخلفية
DELETE /api/products/:id → يحذف من DB فوراً → S3 cleanup في setImmediate

// الحد الأقصى لـ HTTP response: 5 ثوانٍ
// أي عملية تستغرق أكثر → background job
```

---

## 7. ما الذي يعتبر تدهوراً في الأداء؟

```
🔴 Critical (تدخل فوري):
  - أي endpoint يتجاوز p99 > 5s
  - Error rate > 5%
  - DB connections pool exhausted
  - Memory leak (RSS يرتفع باستمرار)
  - Socket.IO latency > 1s

🟠 High (خلال Sprint الحالي):
  - أي endpoint تجاوز p95 > 2s
  - Query > 500ms بدون index
  - N+1 query في production traffic
  - Bundle size > 300KB

🟡 Medium (Sprint القادم):
  - Lighthouse score انخفض عن 80
  - Cache hit rate < 70%
  - Slow query في pg_stat_statements
```

---

## 8. رصد المشاكل

```
الأدوات:
  pg_stat_statements   → أبطأ queries (أسبوعياً)
  Sentry Performance   → API response times (مستمر)
  Lighthouse CI        → Frontend score (مع كل PR)
  Artillery            → Load testing (قبل releases)
  Redis INFO stats     → Cache hit rate (يومياً)

التنبيهات:
  p99 > 2s لأي endpoint → Slack alert فوري
  Error rate > 1%      → Slack alert + Sentry
  Memory > 80%         → PagerDuty
  DB connections > 18  → Slack warning (pool max = 20)
```

---

## القواعد الإلزامية

```
✦ PERF-01: لا SELECT * في production queries
✦ PERF-02: لا N+1 queries — يُكتشَف في Code Review ويُمنع
✦ PERF-03: LIMIT إلزامي على كل query تُعيد قوائم
✦ PERF-04: كل endpoint جديد يُقاس في Staging قبل merge
✦ PERF-05: EXPLAIN ANALYZE قبل إضافة أي index جديد
✦ PERF-06: Code splitting على كل Role — لا bundle ضخم للجميع
✦ PERF-07: Images محسّنة (WebP, lazy loading, max dimensions)
✦ PERF-08: كل عملية > 2s تذهب لـ background job
✦ PERF-09: Redis Cache لـ: stores, products, wallet balance
✦ PERF-10: Load test قبل كل major release
```
