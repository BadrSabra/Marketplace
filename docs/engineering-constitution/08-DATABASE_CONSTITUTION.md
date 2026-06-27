# 08 — Database Constitution
**دستور قاعدة البيانات الإلزامي**

---

## 1. Naming Conventions

```sql
-- جداول: snake_case + plural
users, wallets, wallet_transactions, sub_orders, delivery_offers

-- أعمدة: snake_case
user_id, created_at, is_approved, store_owner_id, transaction_type

-- Foreign Keys: <table_singular>_id
user_id → references users(id)
store_id → references stores(id)
wallet_id → references wallets(id)

-- Indexes: idx_<table>_<columns>
idx_audit_logs_user_id
idx_sub_orders_store_id
idx_products_name_trgm

-- Constraints: <table>_<column>_<type>
users_email_unique
orders_customer_id_fk
wallet_transactions_status_check
```

---

## 2. Primary Keys

```typescript
// ✅ UUID v4 لجميع الجداول — لا auto-increment integers
id: uuid("id").defaultRandom().primaryKey()

// السبب:
// - لا يكشف عدد السجلات
// - آمن للـ API exposure
// - يدعم multi-tenant و data federation مستقبلاً
// - مناسب للـ distributed systems
```

---

## 3. Timestamps الإلزامية

```typescript
// ✅ كل جدول يجب أن يحتوي على:
createdAt: timestamp("created_at").defaultNow().notNull()

// ✅ الجداول القابلة للتعديل تضيف:
updatedAt: timestamp("updated_at")
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date())

// استثناء مقبول: جداول audit و ledger — append-only، لا updatedAt
```

---

## 4. Constraints الإلزامية

```typescript
// ✅ NOT NULL على الحقول الأساسية
userId: uuid("user_id").notNull()
status: text("status").notNull().default("PENDING")

// ✅ CHECK constraints على القيم المحدودة
// تُضاف عبر Drizzle أو migration مباشرة
ALTER TABLE ratings ADD CONSTRAINT ratings_score_check CHECK (score >= 1 AND score <= 5);
ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price > 0);

// ✅ UNIQUE constraints
email: text("email").notNull().unique()
code: text("code").notNull().unique() -- coupons.code

// ✅ Foreign Keys مع ON DELETE behavior مناسب
storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "restrict" })
// لا تحذف store إذا كانت لها orders
```

---

## 5. Normalization

```
First Normal Form (1NF): ✅ كل خلية قيمة واحدة
Second Normal Form (2NF): ✅ لا partial dependencies
Third Normal Form (3NF): ✅ لا transitive dependencies

استثناء مقبول ومعلل:
  users.addresses (jsonb) — عناوين متعددة كـ JSON
  السبب: العناوين لا تُستعلَم بشكل مستقل حالياً
  TODO: تحويل لجدول addresses منفصل عند الحاجة للـ search
```

---

## 6. Indexes Strategy

```sql
-- ✅ إلزامية (موجودة)
CREATE INDEX idx_audit_logs_user_action ON audit_logs (performed_by_user_id, action_type);
CREATE INDEX idx_notifications_user_read ON notifications (user_id, is_read);

-- ✅ مطلوبة (Sprint 1)
CREATE INDEX CONCURRENTLY idx_sub_orders_store_id ON sub_orders(store_id);
CREATE INDEX CONCURRENTLY idx_orders_customer_id ON orders(customer_id);
CREATE INDEX CONCURRENTLY idx_delivery_offers_sub_order_id ON delivery_offers(sub_order_id);
CREATE INDEX CONCURRENTLY idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);

-- ✅ للبحث النصي (Sprint 3)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_stores_name_trgm ON stores USING gin(name gin_trgm_ops);

-- القاعدة: CONCURRENTLY لمنع table lock في production
-- لا تُضيف index بدون قياس أداء الـ query قبله وبعده
```

---

## 7. Migrations

```
القواعد الإلزامية:

✦ DB-M01: لا تعديل مباشر على schema في production بدون migration
✦ DB-M02: كل migration لها rollback script جاهز ومختبر
✦ DB-M03: كل migration تُختبر على Staging أولاً
✦ DB-M04: Backup قاعدة البيانات قبل أي migration
✦ DB-M05: لا DROP TABLE أو DROP COLUMN بدون data archive أولاً
✦ DB-M06: Migrations تُرتَّب بـ timestamp (drizzle-kit يتولى ذلك)
✦ DB-M07: لا تعديل على migration قديم مكتوب — أنشئ migration جديدة

-- مثال rollback script
-- migration: add_tenant_id_to_orders.sql
ALTER TABLE orders ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- rollback: rollback_add_tenant_id_to_orders.sql
ALTER TABLE orders DROP COLUMN IF EXISTS tenant_id;
```

---

## 8. Financial Tables — قواعد خاصة

```
نظام Double-Entry Ledger (موجود ومحمي):

wallet_transactions: كل حركة مالية للمستخدم
ledger: كل قيد محاسبي (DEBIT/CREDIT)

القواعد:
✦ لا تحذف سجلات من wallet_transactions أو ledger أبداً
✦ كل عملية مالية = transaction DB يشمل wallet + ledger في نفس الوقت
✦ balance في wallets تُحسب من wallet_transactions (يمكن إعادة حسابه)
✦ لا تُحدِّث balance مباشرة في wallets بدون wallet_transaction مقابل
✦ المبالغ تُخزَّن كـ numeric(10,2) — لا floating point أبداً
✦ حسابات العملات بـ money.ts — لا JavaScript arithmetic مباشرة
```

---

## 9. Soft Delete Policy

```typescript
// المشروع يستخدم hard delete حالياً مع cleanup للملفات

// عند إضافة Soft Delete (مستقبل):
// ✅ أضف:
deletedAt: timestamp("deleted_at")  // null = نشط، timestamp = محذوف
isDeleted: boolean("is_deleted").default(false)

// ✅ كل query تُضيف:
.where(and(eq(products.storeId, storeId), isNull(products.deletedAt)))

// ✅ API لا تُعيد سجلات محذوفة أبداً
// ✅ Admin يمكنه رؤية المحذوف (soft deleted records)

// متى نستخدم Soft Delete؟
// - products (يريد المتجر رؤية تاريخ المنتجات)
// - stores (يريد الأدمن رؤية المتاجر المغلقة)
// - users (compliance - GDPR)
```

---

## 10. Tenant Isolation (للـ SaaS المستقبلي)

```typescript
// عند إضافة multi-tenancy (Sprint 7):
// ✅ أضف tenant_id لجميع الجداول
tenantId: uuid("tenant_id").notNull().references(() => tenants.id)

// ✅ Row-Level Security بـ PostgreSQL
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ✅ Middleware يُعيِّن tenant_id في كل request:
await db.execute(sql`SET app.tenant_id = ${tenantId}`);

// القاعدة: لا query تُجرى بدون tenant_id filter
// الاختبار: Data Isolation Test Suite إلزامي قبل Production
```

---

## 11. Data Retention

```
سياسة الاحتفاظ بالبيانات:

audit_logs:     لا تُحذف أبداً (compliance) — archive بعد سنة
notifications:  تُحذف بعد 90 يوم
delivery_otps:  تُحذف بعد انتهاء صلاحيتها (cron job)
push_subscriptions: تُحذف عند 410/404 من push provider
chat_messages:  تُحتفظ إلى أجل غير مسمى (مشمولة بـ GDPR)
wallet_transactions: لا تُحذف أبداً (مالية)
ledger:         لا تُحذف أبداً (محاسبية)
```

---

## 12. Backup Policy

```
يومي:   pg_dump → gzip → S3 (05:00 صباحاً)
أسبوعي: نسخة أسبوعية تُحتفظ 4 أسابيع
شهري:   نسخة شهرية تُحتفظ 12 شهراً

اختبار الاسترداد: شهرياً على Staging
RTO (Recovery Time Objective): < 4 ساعات
RPO (Recovery Point Objective): < 24 ساعة (حالياً) → < 1 ساعة (هدف)
```

---

## القواعد الإلزامية

```
✦ DB-01: لا أعمدة بدون وصف واضح لوظيفتها
✦ DB-02: لا جداول مكررة — تحقق من schema.ts قبل إنشاء جدول جديد
✦ DB-03: لا علاقات غير موثقة في schema.ts
✦ DB-04: لا تعديل مباشر على production schema — migration فقط
✦ DB-05: لا floating point للمبالغ — numeric(10,2) حصراً
✦ DB-06: لا حذف من wallet_transactions أو ledger أبداً
✦ DB-07: كل عملية مالية تجري داخل DB transaction
✦ DB-08: كل migration لها rollback script
✦ DB-09: Backup قبل كل migration
✦ DB-10: كل تغيير في schema يمر عبر مراجعة أثر (Impact Analysis)
```
