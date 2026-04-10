import { pool, db } from "../db";
import { users, wallets, stores, orders, subOrders, deliveryOtps, ledger, products, orderItems, deliveryOffers } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Q: لماذا كانت دالة hashPassword() تستخدم scrypt بدلاً من bcrypt؟
// A: كانت الدالة تستخدم خوارزمية scrypt وتُنتج hash بصيغة "hex.salt" المختلفة تماماً
//    عن صيغة bcrypt التي تبدأ بـ "$2". النظام في routes.ts (ensureAdminAccount) يكتشف
//    أن الكلمة ليست bcrypt ويُحدّثها تلقائياً عند كل تشغيل للخادم — مما يُسبب عملية
//    write غير ضرورية لقاعدة البيانات في كل مرة. والأهم: نظام تسجيل الدخول يعتمد بشكل
//    أساسي على bcrypt، ومسار التحقق البديل لـ scrypt قد يفشل في بيئات معينة.
//    الإصلاح: استخدام bcrypt مباشرةً في الـ bootstrap لتوحيد آلية التشفير في كل المسارات.
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function autoVerifyDatabase() {
  console.log("--- DATABASE AUTO-VERIFICATION START ---");
  const report: Record<string, string> = {};

  try {
    // 1. Verify ENUMs
    const enums = [
      { name: 'role', values: ['ADMIN', 'CUSTOMER', 'STORE_OWNER', 'DRIVER'] },
      { name: 'transaction_type', values: ['DEPOSIT', 'WITHDRAWAL', 'REFUND', 'COMMISSION'] },
      { name: 'transaction_status', values: ['PENDING', 'COMPLETED', 'FAILED'] },
      { name: 'order_status', values: ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] },
      { name: 'delivery_status', values: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'] },
      { name: 'payment_status', values: ['PENDING', 'PAID', 'REFUNDED', 'FAILED'] },
      { name: 'offer_status', values: ['PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED'] },
      { name: 'notification_type', values: ['NEW_ORDER', 'ORDER_STATUS_UPDATE', 'NEW_OFFER', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'OFFER_COUNTERED', 'ACCOUNT_APPROVED', 'DEPOSIT_APPROVED', 'DEPOSIT_REJECTED', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED', 'WALLET_UPDATE', 'SYSTEM_ALERT'] }
    ];

    for (const e of enums) {
      const { rowCount } = await pool.query("SELECT 1 FROM pg_type WHERE typname = $1", [e.name]);
      if (rowCount === 0) {
        await pool.query(`CREATE TYPE ${e.name} AS ENUM (${e.values.map(v => `'${v}'`).join(', ')})`);
        report[`Enum:${e.name}`] = "Created ⚠️";
      } else {
        report[`Enum:${e.name}`] = "Exists ✅";
      }
    }

    // 2. Verify Tables (Atomic checks/creations)
    const tableDefinitions: Record<string, string> = {
      users: `CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        email VARCHAR UNIQUE NOT NULL,
        password VARCHAR NOT NULL,
        role role NOT NULL DEFAULT 'CUSTOMER',
        phone VARCHAR,
        is_approved BOOLEAN DEFAULT false,
        transport_type VARCHAR,
        avatar_url TEXT,
        addresses JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      wallets: `CREATE TABLE wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        -- BUG-FIX: Added UNIQUE constraint at table creation time.
        -- Previously the UNIQUE constraint was only added via ALTER TABLE later in the script,
        -- creating a window between CREATE TABLE and ALTER TABLE where concurrent requests
        -- could insert duplicate wallet rows for the same user.
        user_id UUID NOT NULL UNIQUE REFERENCES users(id),
        balance DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      stores: `CREATE TABLE stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id),
        name VARCHAR NOT NULL,
        type VARCHAR,
        description TEXT,
        location_text TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      orders: `CREATE TABLE orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES users(id),
        overall_status order_status NOT NULL DEFAULT 'PENDING',
        delivery_status delivery_status NOT NULL DEFAULT 'PENDING',
        payment_status payment_status NOT NULL DEFAULT 'PENDING',
        total_price DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      sub_orders: `CREATE TABLE sub_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        store_id UUID NOT NULL REFERENCES stores(id),
        status order_status NOT NULL DEFAULT 'PENDING',
        subtotal DECIMAL(10,2) NOT NULL,
        assigned_driver_id UUID REFERENCES users(id),
        expected_delivery_fee DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      delivery_otps: `CREATE TABLE delivery_otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        sub_order_id UUID REFERENCES sub_orders(id),
        otp_code TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        attempt_count INTEGER DEFAULT 0,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      ledger: `CREATE TABLE ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reference_id UUID,
        debit_user_id UUID REFERENCES users(id),
        credit_user_id UUID REFERENCES users(id),
        amount DECIMAL(12,2) NOT NULL,
        type transaction_type NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      wallet_transactions: `CREATE TABLE wallet_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_id UUID NOT NULL REFERENCES wallets(id),
        type transaction_type NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        related_order_id UUID,
        status transaction_status NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      products: `CREATE TABLE products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id),
        name VARCHAR NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        category VARCHAR NOT NULL DEFAULT 'General',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      order_items: `CREATE TABLE order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sub_order_id UUID NOT NULL REFERENCES sub_orders(id),
        product_id UUID NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price_at_order DECIMAL(10,2) NOT NULL
      )`,
      delivery_offers: `CREATE TABLE delivery_offers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sub_order_id UUID NOT NULL REFERENCES sub_orders(id),
        driver_id UUID NOT NULL REFERENCES users(id),
        offered_fee DECIMAL(10,2) NOT NULL,
        status offer_status NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      ratings: `CREATE TABLE ratings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        from_user_id UUID NOT NULL REFERENCES users(id),
        to_user_id UUID NOT NULL REFERENCES users(id),
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      audit_logs: `CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        performed_by_user_id UUID NOT NULL REFERENCES users(id),
        performed_by_role TEXT NOT NULL,
        old_value JSONB,
        new_value JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      chat_rooms: `CREATE TABLE chat_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL CHECK (type IN ('ORDER_STORE','ORDER_DRIVER','SUPPORT')),
        reference_id UUID,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      chat_participants: `CREATE TABLE chat_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at TIMESTAMP,
        joined_at TIMESTAMP DEFAULT NOW()
      )`,
      chat_messages: `CREATE TABLE chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'TEXT' CHECK (type IN ('TEXT','SYSTEM')),
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      notifications: `CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type notification_type NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      push_subscriptions: `CREATE TABLE push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      withdrawal_requests: `CREATE TABLE withdrawal_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        wallet_id UUID NOT NULL REFERENCES wallets(id),
        amount NUMERIC(12,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
        admin_note TEXT,
        reviewed_by_admin_id UUID REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      // Q: هل جدول support_messages موجود في bootstrap؟
      // A: لا — كان مفقوداً تماماً رغم وجوده في schema.ts. أي قاعدة بيانات جديدة
      //    ستفشل فور محاولة إرسال أو استقبال رسالة دعم، إذ ستُرجع PostgreSQL
      //    خطأ "relation 'support_messages' does not exist" وتُعطّل ميزة دعم العملاء.
      //    الإصلاح: إضافة تعريف الجدول إلى قائمة التحقق التلقائي.
      support_messages: `CREATE TABLE support_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES users(id),
        sender_role TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    };

    for (const [name, sql] of Object.entries(tableDefinitions)) {
      const { rows } = await pool.query(`SELECT to_regclass('public.${name}')`);
      if (!rows[0].to_regclass) {
        await pool.query(sql);
        report[`Table:${name}`] = "Created ⚠️";
      } else {
        report[`Table:${name}`] = "Exists ✅";
      }
    }

    // 3. Verify Columns & Indexes
    // Q: لماذا توجد أعمدة في columnChecks بينما هي موجودة بالفعل في تعريف CREATE TABLE؟
    // A: بعض هذه الأعمدة (كـ related_order_id في wallet_transactions) أُضيفت لاحقاً
    //    بعد نشر قاعدة البيانات الأولى، ولم تكن موجودة في تعريف CREATE TABLE الأصلي.
    //    الـ columnChecks تعمل كـ "migration تلقائية" لقواعد البيانات القائمة فعلاً:
    //    - قواعد البيانات الجديدة: تجد الأعمدة موجودة بالفعل من CREATE TABLE → لا تعديل
    //    - قواعد البيانات القديمة: تجد الأعمدة ناقصة → تُضيفها بـ ALTER TABLE
    //    الوضع الحالي: فحص wallet_transactions.related_order_id مُكرَّر (موجود في CREATE
    //    TABLE وفي columnChecks) — يُشغّل استعلام information_schema زيادةً عن الحاجة
    //    في كل إقلاع، لكنه غير ضار. الإصلاح المستقبلي: حذفه من columnChecks بعد التأكد
    //    من أن جميع بيئات الإنتاج تحمل النسخة الحديثة من قاعدة البيانات.
    const columnChecks = [
      { table: 'delivery_otps', column: 'otp_code', type: 'TEXT NOT NULL' },
      { table: 'delivery_otps', column: 'status', type: 'TEXT NOT NULL DEFAULT \'PENDING\'' },
      { table: 'delivery_otps', column: 'expires_at', type: 'TIMESTAMP NOT NULL' },
      { table: 'delivery_otps', column: 'attempt_count', type: 'INTEGER DEFAULT 0' },
      { table: 'ledger', column: 'type', type: 'transaction_type NOT NULL' },
      { table: 'ledger', column: 'reference_id', type: 'UUID' },
      { table: 'users', column: 'drivers_license_url', type: 'TEXT' },
      { table: 'products', column: 'image_url', type: 'TEXT' },
      { table: 'stores', column: 'image_url', type: 'TEXT' },
      { table: 'wallet_transactions', column: 'receipt_url', type: 'TEXT' },
      // Q: هل فحص related_order_id هنا زائد عن الحاجة؟
      // A: نعم لقواعد البيانات الجديدة (موجود في CREATE TABLE أعلاه)، لكن لا يزال
      //    ضرورياً لقواعد البيانات القديمة التي أُنشئت قبل إضافة هذا العمود.
      { table: 'wallet_transactions', column: 'related_order_id', type: 'UUID' },
      { table: 'wallet_transactions', column: 'notes', type: 'TEXT' },
      { table: 'delivery_offers', column: 'counter_offered_fee', type: 'DECIMAL(10,2)' }
    ];

    for (const check of columnChecks) {
      const { rowCount } = await pool.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [check.table, check.column]);
      if (rowCount === 0) {
        await pool.query(`ALTER TABLE ${check.table} ADD COLUMN ${check.column} ${check.type}`);
        report[`Column:${check.table}.${check.column}`] = "Created ⚠️";
      } else {
        report[`Column:${check.table}.${check.column}`] = "Exists ✅";
      }
    }

    const indexCheck = await pool.query(`SELECT 1 FROM pg_indexes WHERE indexname = 'sub_order_pending_idx'`);
    if (indexCheck.rowCount === 0) {
      await pool.query(`CREATE INDEX sub_order_pending_idx ON delivery_otps (sub_order_id, status)`);
      report[`Index:sub_order_pending_idx`] = "Created ⚠️";
    } else {
      report[`Index:sub_order_pending_idx`] = "Exists ✅";
    }

    const notifIndexCheck = await pool.query(`SELECT 1 FROM pg_indexes WHERE indexname = 'notifications_user_idx'`);
    if (notifIndexCheck.rowCount === 0) {
      await pool.query(`CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, is_read)`);
      report[`Index:notifications_user_idx`] = "Created ⚠️";
    } else {
      report[`Index:notifications_user_idx`] = "Exists ✅";
    }

    // BUG-FIX: Ensure UNIQUE constraint on wallets(user_id).
    // Without it, concurrent getOrCreateWallet() calls could create duplicate wallet rows.
    const walletUniqueCheck = await pool.query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'wallets' AND constraint_type = 'UNIQUE'
      AND constraint_name = 'wallets_user_id_unique'
    `);
    if (walletUniqueCheck.rowCount === 0) {
      // Remove any duplicate wallets first (keep the oldest row per user)
      await pool.query(`
        DELETE FROM wallets w1
        USING wallets w2
        WHERE w1.user_id = w2.user_id AND w1.created_at > w2.created_at
      `);
      await pool.query(`ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_unique UNIQUE (user_id)`);
      report[`Constraint:wallets_user_id_unique`] = "Created ⚠️";
    } else {
      report[`Constraint:wallets_user_id_unique`] = "Exists ✅";
    }

    // 4. Verify Default Data (Atomic Transaction)
    await db.transaction(async (tx) => {
      const [admin] = await tx.select().from(users).where(eq(users.email, "admin@mitgaber.com")).limit(1);
      if (!admin) {
        const hashedPassword = await hashPassword("Admin@123");
        const [newAdmin] = await tx.insert(users).values({
          name: "Admin",
          email: "admin@mitgaber.com",
          password: hashedPassword,
          role: "ADMIN",
          isApproved: true,
        }).returning();
        
        await tx.insert(wallets).values({
          userId: newAdmin.id,
          balance: "0.00",
        });
        report[`Data:AdminAccount`] = "Created ⚠️";
      } else {
        const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, admin.id)).limit(1);
        if (!wallet) {
          await tx.insert(wallets).values({ userId: admin.id, balance: "0.00" });
          report[`Data:AdminWallet`] = "Created ⚠️";
        } else {
          report[`Data:AdminAccount`] = "Exists ✅";
        }
      }
    });

    // 5. إنشاء حساب سوبر ماركت أولاد عزب
    await db.transaction(async (tx) => {
      const AWLAD_AZAB_EMAIL = "awlad.azab@supermarket.com";
      const [existingOwner] = await tx.select().from(users).where(eq(users.email, AWLAD_AZAB_EMAIL)).limit(1);
      
      if (!existingOwner) {
        const hashedPassword = await hashPassword("AwladAzab@2024");
        const [storeOwner] = await tx.insert(users).values({
          name: "سوبر ماركت أولاد عزب",
          email: AWLAD_AZAB_EMAIL,
          password: hashedPassword,
          phone: "01000000001",
          role: "STORE_OWNER",
          isApproved: true,
        }).returning();

        await tx.insert(wallets).values({ userId: storeOwner.id, balance: "0.00" });

        const [newStore] = await tx.insert(stores).values({
          ownerId: storeOwner.id,
          name: "سوبر ماركت أولاد عزب",
          type: "سوبر ماركت",
          description: "سوبر ماركت أولاد عزب - وجهتك الأولى لأفضل المنتجات الغذائية ومستلزمات المنزل بأسعار مناسبة وجودة عالية",
          locationText: "ميت غمر، محافظة الدقهلية",
          imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800",
        }).returning();

        const supermarketProducts = [
          { name: "أرز مصري الضهة", description: "أرز مصري فاخر حبة متوسطة - 1 كجم", price: "45.00", stock: 200, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1536304993881-ff86e0c9f2a3?w=400" },
          { name: "دقيق الضهة متعدد الأغراض", description: "دقيق أبيض فاخر لجميع الاستخدامات - 1 كجم", price: "28.00", stock: 150, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400" },
          { name: "سكر أبيض ناعم", description: "سكر أبيض ناعم عالي الجودة - 1 كجم", price: "35.00", stock: 200, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400" },
          { name: "زيت ذرة صافي", description: "زيت ذرة صافي للطهي - 1.5 لتر", price: "75.00", stock: 120, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400" },
          { name: "زيت زيتون بكر ممتاز", description: "زيت زيتون بكر ممتاز إضافي - 750 مل", price: "120.00", stock: 80, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400" },
          { name: "عدس أحمر مقشور", description: "عدس أحمر مقشور فاخر - 500 جم", price: "22.00", stock: 180, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400" },
          { name: "فول مدمس", description: "فول مدمس جاهز للأكل - علبة 400 جم", price: "18.00", stock: 200, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400" },
          { name: "معكرونة سباغيتي", description: "معكرونة سباغيتي إيطالية - 500 جم", price: "25.00", stock: 150, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400" },
          { name: "خبز توست أبيض", description: "خبز توست أبيض طازج - رغيف 500 جم", price: "20.00", stock: 100, category: "مخبوزات", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400" },
          { name: "خبز عيش بلدي", description: "عيش بلدي طازج - كيس 10 أرغفة", price: "15.00", stock: 150, category: "مخبوزات", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400" },
          { name: "لبن طازج كامل الدسم", description: "لبن طازج بستريز كامل الدسم - 1 لتر", price: "32.00", stock: 100, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400" },
          { name: "زبادي طبيعي", description: "زبادي طبيعي كريمي - 4 أكواب", price: "28.00", stock: 80, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400" },
          { name: "جبنة رومي مطبوخة", description: "جبنة رومي مطبوخة فاخرة - 200 جم", price: "45.00", stock: 60, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400" },
          { name: "جبنة أبيض بلدي", description: "جبنة بيضاء طازجة - 250 جم", price: "35.00", stock: 80, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400" },
          { name: "بيض بلدي طازج", description: "بيض بلدي طازج - كرتونة 15 بيضة", price: "65.00", stock: 120, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400" },
          { name: "زبدة طبيعية", description: "زبدة طبيعية مملحة - 200 جم", price: "55.00", stock: 70, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400" },
          { name: "طماطم طازجة", description: "طماطم مصرية طازجة - 1 كجم", price: "15.00", stock: 100, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400" },
          { name: "بطاطس مصرية", description: "بطاطس مصرية طازجة - 1 كجم", price: "12.00", stock: 150, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400" },
          { name: "بصل جاف", description: "بصل جاف مصري - 1 كجم", price: "10.00", stock: 200, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400" },
          { name: "ثوم بلدي", description: "ثوم بلدي طازج - 250 جم", price: "20.00", stock: 100, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=400" },
          { name: "موز", description: "موز طازج من أجود الأصناف - 1 كجم", price: "30.00", stock: 80, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400" },
          { name: "تفاح أحمر", description: "تفاح أحمر طازج - 1 كجم", price: "45.00", stock: 70, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400" },
          { name: "فراخ بيضاء طازجة", description: "دجاج كامل طازج - 1 كجم", price: "95.00", stock: 60, category: "لحوم ودواجن", imageUrl: "https://images.unsplash.com/photo-1604503468506-a8da13d11bae?w=400" },
          { name: "فيليه دجاج", description: "فيليه صدر دجاج طازج بدون عظم - 1 كجم", price: "130.00", stock: 50, category: "لحوم ودواجن", imageUrl: "https://images.unsplash.com/photo-1604503468506-a8da13d11bae?w=400" },
          { name: "لحم بتلو مفروم", description: "لحم بتلو مفروم طازج - 500 جم", price: "120.00", stock: 40, category: "لحوم ودواجن", imageUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400" },
          { name: "مياه معدنية بارودة", description: "مياه معدنية نقية - 1.5 لتر", price: "10.00", stock: 300, category: "مشروبات", imageUrl: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400" },
          { name: "عصير برتقال طبيعي", description: "عصير برتقال 100% طبيعي - 1 لتر", price: "45.00", stock: 80, category: "مشروبات", imageUrl: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400" },
          { name: "كولا", description: "مشروب غازي كولا - 1.5 لتر", price: "28.00", stock: 150, category: "مشروبات", imageUrl: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400" },
          { name: "شاي أحمر أكياس", description: "شاي أحمر أكياس فاخر - علبة 100 كيس", price: "55.00", stock: 100, category: "مشروبات", imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
          { name: "نسكافيه قهوة فورية", description: "نسكافيه قهوة فورية - 200 جم", price: "85.00", stock: 70, category: "مشروبات", imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400" },
          { name: "شيبسي بطاطس مقرمشة", description: "شيبسي بطاطس مقرمشة بالملح - 80 جم", price: "18.00", stock: 150, category: "وجبات خفيفة", imageUrl: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400" },
          { name: "كيكة شوكولاتة", description: "كيكة شوكولاتة فاخرة - 350 جم", price: "42.00", stock: 60, category: "وجبات خفيفة", imageUrl: "https://images.unsplash.com/photo-1548368814-1f7ec1261b60?w=400" },
          { name: "بسكويت شاي ماري", description: "بسكويت ماري للشاي - 200 جم", price: "25.00", stock: 120, category: "وجبات خفيفة", imageUrl: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400" },
          { name: "شوكولاتة حليب", description: "شوكولاتة حليب كاملة - 100 جم", price: "35.00", stock: 100, category: "وجبات خفيفة", imageUrl: "https://images.unsplash.com/photo-1548907040-4baa42d10919?w=400" },
          { name: "حلاوة طحينية", description: "حلاوة طحينية سادة فاخرة - 500 جم", price: "48.00", stock: 80, category: "وجبات خفيفة", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400" },
          { name: "صابون استحمام", description: "صابون استحمام بجليسرين - 3 قطع", price: "32.00", stock: 150, category: "عناية شخصية", imageUrl: "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=400" },
          { name: "شامبو للشعر العادي", description: "شامبو مغذي للشعر العادي - 400 مل", price: "65.00", stock: 80, category: "عناية شخصية", imageUrl: "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400" },
          { name: "معجون أسنان بالفلوريد", description: "معجون أسنان بالفلوريد للحماية - 100 مل", price: "35.00", stock: 120, category: "عناية شخصية", imageUrl: "https://images.unsplash.com/photo-1605634279219-b1a4ce4e7b90?w=400" },
          { name: "فوطة صحية نهارية", description: "فوطة صحية نهارية فائقة الامتصاص - 8 قطع", price: "28.00", stock: 100, category: "عناية شخصية", imageUrl: "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=400" },
          { name: "سائل جلي الصحون", description: "سائل جلي الصحون معطر - 500 مل", price: "22.00", stock: 150, category: "منتجات تنظيف", imageUrl: "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400" },
          { name: "مسحوق غسيل ملابس", description: "مسحوق غسيل الملابس الملون والأبيض - 1 كجم", price: "55.00", stock: 100, category: "منتجات تنظيف", imageUrl: "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400" },
          { name: "مطهر متعدد الأسطح", description: "مطهر ومعقم متعدد الأسطح برائحة الورد - 750 مل", price: "38.00", stock: 80, category: "منتجات تنظيف", imageUrl: "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400" },
          { name: "إسفنجة جلي المطبخ", description: "إسفنجة جلي المطبخ 2 في 1 - 3 قطع", price: "18.00", stock: 200, category: "منتجات تنظيف", imageUrl: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400" },
          { name: "تونة معلبة بالزيت", description: "تونة معلبة بزيت الذرة - 185 جم", price: "32.00", stock: 200, category: "معلبات", imageUrl: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=400" },
          { name: "صلصة طماطم معلبة", description: "صلصة طماطم معلبة جاهزة - 400 جم", price: "25.00", stock: 150, category: "معلبات", imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400" },
          { name: "ذرة معلبة صفراء", description: "ذرة صفراء معلبة طبيعية - 340 جم", price: "20.00", stock: 180, category: "معلبات", imageUrl: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400" },
          { name: "فاصوليا بيضاء معلبة", description: "فاصوليا بيضاء معلبة بالصلصة - 400 جم", price: "22.00", stock: 150, category: "معلبات", imageUrl: "https://images.unsplash.com/photo-1584348571977-09f3b7ab7a00?w=400" },
        ];

        for (const p of supermarketProducts) {
          await tx.insert(products).values({ storeId: newStore.id, ...p });
        }

        report[`Data:AwladAzabStore`] = "Created ⚠️";
      } else {
        report[`Data:AwladAzabStore`] = "Exists ✅";
      }
    });

    console.table(report);
    console.log("--- DATABASE AUTO-VERIFICATION COMPLETE: HEALTHY ✅ ---");
    return true;
  } catch (error) {
    console.error("--- DATABASE AUTO-VERIFICATION FAILED ❌ ---", error);
    throw error;
  }
}
