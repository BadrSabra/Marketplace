# 15 — Performance Checklist

---

## Database

| # | البند | الحالة | الأولوية |
|---|-------|--------|---------|
| DB-01 | Connection Pool (max 20, timeout 5s) | ✅ موجود | — |
| DB-02 | Index على audit_logs (4 حقول) | ✅ موجود | — |
| DB-03 | Index على notifications (userId, isRead) | ✅ موجود | — |
| DB-04 | Index على sub_order_pending_idx | ✅ موجود | — |
| DB-05 | Index على sub_orders.store_id | ❌ غير موجود | 🟠 High |
| DB-06 | Index على orders.customer_id | ❌ غير موجود | 🟠 High |
| DB-07 | Index على delivery_offers.sub_order_id | ❌ غير موجود | 🟡 Medium |
| DB-08 | Index على products.name (pg_trgm للبحث) | ❌ غير موجود | 🟡 Medium |
| DB-09 | لا N+1 queries (getCustomerOrders مُصلَح) | ✅ موجود | — |
| DB-10 | getStores() بها pagination | ❌ غير موجود | 🟠 High |
| DB-11 | Read Replica للاستعلامات | ❌ غير موجود | 🟡 Medium (Scale) |
| DB-12 | Partitioning لـ audit_logs (تاريخية) | ❌ غير موجود | 🔵 Low |

---

## API

| # | البند | الحالة | الأولوية |
|---|-------|--------|---------|
| API-01 | Pagination في orders, products, audit | ✅ موجود | — |
| API-02 | Pagination في stores | ❌ غير موجود | 🟠 High |
| API-03 | Pagination في wallet transactions | ✅ موجود | — |
| API-04 | Response compression (gzip/brotli) | ❌ غير موجود | 🟡 Medium |
| API-05 | HTTP caching headers (ETag/Cache-Control) | ❌ غير موجود | 🟡 Medium |
| API-06 | Query string validation قبل DB | ✅ جزئياً | — |
| API-07 | Timeout للـ external requests | ❌ غير موجود | 🟡 Medium |

---

## Caching

| # | البند | الحالة | الأولوية |
|---|-------|--------|---------|
| CACHE-01 | Redis للـ sessions | ❌ غير موجود | 🔴 Critical |
| CACHE-02 | Redis لـ stores list (TTL: 5min) | ❌ غير موجود | 🟠 High |
| CACHE-03 | Redis لـ products per store (TTL: 2min) | ❌ غير موجود | 🟠 High |
| CACHE-04 | Redis لـ admin stats (TTL: 1min) | ❌ غير موجود | 🟡 Medium |
| CACHE-05 | Redis لـ JWT blacklist | ❌ غير موجود | 🔴 Critical |
| CACHE-06 | Socket.IO Redis Adapter | ❌ غير موجود | 🟠 High |

---

## Frontend

| # | البند | الحالة | الأولوية |
|---|-------|--------|---------|
| FE-01 | Code splitting (lazy loading للـ pages) | ❌ غير موجود | 🟠 High |
| FE-02 | TanStack Query caching (5min staleTime) | ✅ موجود | — |
| FE-03 | Optimistic UI updates | ⚠️ جزئي | 🟡 Medium |
| FE-04 | Suspense + fallback | ✅ موجود | — |
| FE-05 | مكونات Skeleton Loading | ⚠️ جزئي | 🟡 Medium |
| FE-06 | لا re-renders غير ضروري (React.memo) | ⚠️ غير مستخدم | 🟡 Medium |

---

## Images

| # | البند | الحالة | الأولوية |
|---|-------|--------|---------|
| IMG-01 | Image compression عند الرفع (Sharp) | ❌ غير موجود | 🟠 High |
| IMG-02 | WebP format | ❌ غير موجود | 🟠 High |
| IMG-03 | Responsive images (srcset) | ❌ غير موجود | 🟡 Medium |
| IMG-04 | Lazy loading للصور | ❌ غير موجود | 🟡 Medium |
| IMG-05 | CDN للصور | ❌ (ينتظر Cloud Storage) | 🟠 مع S3 |
| IMG-06 | Max image size validation | ✅ 10MB limit | — |

---

## Background Jobs

| # | البند | الحالة | الأولوية |
|---|-------|--------|---------|
| JOB-01 | Push Notifications بشكل async (Queue) | ❌ حالياً sync | 🟠 High |
| JOB-02 | Email sending بشكل async | ❌ حالياً sync | 🟠 High |
| JOB-03 | Image processing بشكل async | ❌ غير موجود | 🟡 Medium |
| JOB-04 | OTPs منتهية تُحذف دورياً (cleanup job) | ❌ غير موجود | 🟡 Medium |
| JOB-05 | DB Backup تلقائي يومي | ❌ غير موجود | 🟠 High |

---

## Indexes SQL المطلوبة (فوراً)

```sql
-- أولوية عالية
CREATE INDEX CONCURRENTLY idx_sub_orders_store_id ON sub_orders(store_id);
CREATE INDEX CONCURRENTLY idx_orders_customer_id ON orders(customer_id);
CREATE INDEX CONCURRENTLY idx_delivery_offers_sub_order_id ON delivery_offers(sub_order_id);
CREATE INDEX CONCURRENTLY idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);

-- أولوية متوسطة
CREATE INDEX CONCURRENTLY idx_products_store_id ON products(store_id);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_stores_type ON stores(type);
```

---

## CDN & Compression

| # | البند | الحالة | الأولوية |
|---|-------|--------|---------|
| CDN-01 | Cloudflare CDN للـ static assets | ❌ غير موجود | 🟡 Medium |
| CDN-02 | gzip compression middleware | ❌ غير موجود | 🟡 Medium |
| CDN-03 | Brotli compression | ❌ غير موجود | 🔵 Low |
| CDN-04 | Cache-Control headers للـ static | ❌ غير موجود | 🟡 Medium |
