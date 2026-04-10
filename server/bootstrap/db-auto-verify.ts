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
          { name: "أرز مصري الضهة", description: "أرز مصري فاخر حبة متوسطة - 1 كجم", price: "45.00", stock: 200, category: "بقالة وغذاء أساسي", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/643679/1734340204/643679_main.jpg?im=Resize=400" },
          { name: "دقيق الضهة متعدد الأغراض", description: "دقيق أبيض فاخر لجميع الاستخدامات - 1 كجم", price: "28.00", stock: 150, category: "بقالة وغذاء أساسي", imageUrl: "https://cdn.mafrservices.com/sys-master-root/haa/h55/49347609919518/603320_main.jpg?im=Resize=400" },
          { name: "سكر أبيض ناعم", description: "سكر أبيض ناعم عالي الجودة - 1 كجم", price: "35.00", stock: 200, category: "بقالة وغذاء أساسي", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h82/hcf/47672346378270/575809_main.jpg?im=Resize=400" },
          { name: "زيت ذرة صافي", description: "زيت ذرة صافي للطهي - 1.5 لتر", price: "75.00", stock: 120, category: "بقالة وغذاء أساسي", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/543989/1767171600/543989_main.jpg?im=Resize=400" },
          { name: "زيت زيتون بكر ممتاز", description: "زيت زيتون بكر ممتاز إضافي - 750 مل", price: "120.00", stock: 80, category: "بقالة وغذاء أساسي", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/544731/1750163403/544731_main.jpg?im=Resize=400" },
          { name: "عدس أحمر مقشور", description: "عدس أحمر مقشور فاخر - 500 جم", price: "22.00", stock: 180, category: "بقالة وغذاء أساسي", imageUrl: "https://cdn.mafrservices.com/sys-master-root/hf8/h39/10069404385310/497482_main.jpg?im=Resize=400" },
          { name: "فول مدمس", description: "فول مدمس جاهز للأكل - علبة 400 جم", price: "18.00", stock: 200, category: "بقالة وغذاء أساسي", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h8c/h41/13156672634910/497471_main.jpg?im=Resize=400" },
          { name: "معكرونة سباغيتي", description: "معكرونة سباغيتي إيطالية - 500 جم", price: "25.00", stock: 150, category: "بقالة وغذاء أساسي", imageUrl: "https://cdn.mafrservices.com/sys-master-root/ha4/h1a/48236821381150/46863_main.jpg?im=Resize=400" },
          { name: "خبز توست أبيض", description: "خبز توست أبيض طازج - رغيف 500 جم", price: "20.00", stock: 100, category: "مخبوزات", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h19/h5e/33103907946526/576751_main.jpg?im=Resize=400" },
          { name: "خبز عيش بلدي", description: "عيش بلدي طازج - كيس 10 أرغفة", price: "15.00", stock: 150, category: "مخبوزات", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h4c/hc2/47672346738718/597064_main.jpg?im=Resize=400" },
          { name: "لبن طازج كامل الدسم", description: "لبن طازج بستريز كامل الدسم - 1 لتر", price: "32.00", stock: 100, category: "ألبان وبيض", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h50/h22/28115740426270/497652_main.jpg?im=Resize=400" },
          { name: "زبادي طبيعي", description: "زبادي طبيعي كريمي - 4 أكواب", price: "28.00", stock: 80, category: "ألبان وبيض", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h7f/hf6/10069415657502/497649_main.jpg?im=Resize=400" },
          { name: "جبنة رومي مطبوخة", description: "جبنة رومي مطبوخة فاخرة - 200 جم", price: "45.00", stock: 60, category: "ألبان وبيض", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h89/ha6/14481663721502/497669_main.jpg?im=Resize=400" },
          { name: "جبنة أبيض بلدي", description: "جبنة بيضاء طازجة - 250 جم", price: "35.00", stock: 80, category: "ألبان وبيض", imageUrl: "https://cdn.mafrservices.com/sys-master-root/hf7/h53/14481664081950/497657_main.jpg?im=Resize=400" },
          { name: "بيض بلدي طازج", description: "بيض بلدي طازج - كرتونة 15 بيضة", price: "65.00", stock: 120, category: "ألبان وبيض", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/604274/1773140400/604274_main.jpg?im=Resize=400" },
          { name: "زبدة طبيعية", description: "زبدة طبيعية مملحة - 200 جم", price: "55.00", stock: 70, category: "ألبان وبيض", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/543987/1767171600/543987_main.jpg?im=Resize=400" },
          { name: "طماطم طازجة", description: "طماطم مصرية طازجة - 1 كجم", price: "15.00", stock: 100, category: "خضروات وفواكه", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/17115/1751360404/17115_main.jpg?im=Resize=400" },
          { name: "بطاطس مصرية", description: "بطاطس مصرية طازجة - 1 كجم", price: "12.00", stock: 150, category: "خضروات وفواكه", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h3e/h0a/14786165211166/390593_main.jpg?im=Resize=400" },
          { name: "بصل جاف", description: "بصل جاف مصري - 1 كجم", price: "10.00", stock: 200, category: "خضروات وفواكه", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/648880/1748786403/648880_main.jpg?im=Resize=400" },
          { name: "ثوم بلدي", description: "ثوم بلدي طازج - 250 جم", price: "20.00", stock: 100, category: "خضروات وفواكه", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/638916/1730104803/638916_main.jpg?im=Resize=400" },
          { name: "موز", description: "موز طازج من أجود الأصناف - 1 كجم", price: "30.00", stock: 80, category: "خضروات وفواكه", imageUrl: "https://cdn.mafrservices.com/sys-master-root/hd3/h21/34030262747166/591249_main.jpg?im=Resize=400" },
          { name: "تفاح أحمر", description: "تفاح أحمر طازج - 1 كجم", price: "45.00", stock: 70, category: "خضروات وفواكه", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h96/hf6/29790682447902/305065_main.jpg?im=Resize=400" },
          { name: "فراخ بيضاء طازجة", description: "دجاج كامل طازج - 1 كجم", price: "95.00", stock: 60, category: "لحوم ودواجن", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h1d/h65/48623006122014/607876_main.jpg?im=Resize=400" },
          { name: "فيليه دجاج", description: "فيليه صدر دجاج طازج بدون عظم - 1 كجم", price: "130.00", stock: 50, category: "لحوم ودواجن", imageUrl: "https://cdn.mafrservices.com/sys-master-root/hed/hfe/29790682120222/305062_main.jpg?im=Resize=400" },
          { name: "لحم بتلو مفروم", description: "لحم بتلو مفروم طازج - 500 جم", price: "120.00", stock: 40, category: "لحوم ودواجن", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h8a/hb0/50684371730462/616668_main.jpg?im=Resize=400" },
          { name: "مياه معدنية بارودة", description: "مياه معدنية نقية - 1.5 لتر", price: "10.00", stock: 300, category: "مشروبات", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h96/hf6/29790682447902/305065_main.jpg?im=Resize=400" },
          { name: "عصير برتقال طبيعي", description: "عصير برتقال 100% طبيعي - 1 لتر", price: "45.00", stock: 80, category: "مشروبات", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h1d/h65/48623006122014/607876_main.jpg?im=Resize=400" },
          { name: "كولا", description: "مشروب غازي كولا - 1.5 لتر", price: "28.00", stock: 150, category: "مشروبات", imageUrl: "https://cdn.mafrservices.com/sys-master-root/hed/hfe/29790682120222/305062_main.jpg?im=Resize=400" },
          { name: "شاي أحمر أكياس", description: "شاي أحمر أكياس فاخر - علبة 100 كيس", price: "55.00", stock: 100, category: "مشروبات", imageUrl: "https://cdn.mafrservices.com/sys-master-root/hf7/h40/13216005521438/497368_main.jpg?im=Resize=400" },
          { name: "نسكافيه قهوة فورية", description: "نسكافيه قهوة فورية - 200 جم", price: "85.00", stock: 70, category: "مشروبات", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h9a/hcb/13271296442398/497375_main.jpg?im=Resize=400" },
          { name: "شيبسي بطاطس مقرمشة", description: "شيبسي بطاطس مقرمشة بالملح - 80 جم", price: "18.00", stock: 150, category: "وجبات خفيفة", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/660035/1766655602/660035_main.jpg?im=Resize=400" },
          { name: "كيكة شوكولاتة", description: "كيكة شوكولاتة فاخرة - 350 جم", price: "42.00", stock: 60, category: "وجبات خفيفة", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/97982/1742110203/97982_main.jpg?im=Resize=400" },
          { name: "بسكويت شاي ماري", description: "بسكويت ماري للشاي - 200 جم", price: "25.00", stock: 120, category: "وجبات خفيفة", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/620023/1744626604/620023_main.jpg?im=Resize=400" },
          { name: "شوكولاتة حليب", description: "شوكولاتة حليب كاملة - 100 جم", price: "35.00", stock: 100, category: "وجبات خفيفة", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/660031/1755073803/660031_main.jpg?im=Resize=400" },
          { name: "حلاوة طحينية", description: "حلاوة طحينية سادة فاخرة - 500 جم", price: "48.00", stock: 80, category: "وجبات خفيفة", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h1f/hfe/51742725865502/19476_main.jpg?im=Resize=400" },
          { name: "صابون استحمام", description: "صابون استحمام بجليسرين - 3 قطع", price: "32.00", stock: 150, category: "عناية شخصية", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h50/h22/28115740426270/497652_main.jpg?im=Resize=400" },
          { name: "شامبو للشعر العادي", description: "شامبو مغذي للشعر العادي - 400 مل", price: "65.00", stock: 80, category: "عناية شخصية", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h7f/hf6/10069415657502/497649_main.jpg?im=Resize=400" },
          { name: "معجون أسنان بالفلوريد", description: "معجون أسنان بالفلوريد للحماية - 100 مل", price: "35.00", stock: 120, category: "عناية شخصية", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h89/ha6/14481663721502/497669_main.jpg?im=Resize=400" },
          { name: "فوطة صحية نهارية", description: "فوطة صحية نهارية فائقة الامتصاص - 8 قطع", price: "28.00", stock: 100, category: "عناية شخصية", imageUrl: "https://cdn.mafrservices.com/sys-master-root/hf7/h53/14481664081950/497657_main.jpg?im=Resize=400" },
          { name: "سائل جلي الصحون", description: "سائل جلي الصحون معطر - 500 مل", price: "22.00", stock: 150, category: "منتجات تنظيف", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/651633/1745745005/651633_main.jpg?im=Resize=400" },
          { name: "مسحوق غسيل ملابس", description: "مسحوق غسيل الملابس الملون والأبيض - 1 كجم", price: "55.00", stock: 100, category: "منتجات تنظيف", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/637632/1728307803/637632_main.jpg?im=Resize=400" },
          { name: "مطهر متعدد الأسطح", description: "مطهر ومعقم متعدد الأسطح برائحة الورد - 750 مل", price: "38.00", stock: 80, category: "منتجات تنظيف", imageUrl: "https://cdn.mafrservices.com/pim-content/EGY/media/product/651629/1751198404/651629_main.jpg?im=Resize=400" },
          { name: "إسفنجة جلي المطبخ", description: "إسفنجة جلي المطبخ 2 في 1 - 3 قطع", price: "18.00", stock: 200, category: "منتجات تنظيف", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h7d/h4d/13012496220190/528445_main.jpg?im=Resize=400" },
          { name: "تونة معلبة بالزيت", description: "تونة معلبة بزيت الذرة - 185 جم", price: "32.00", stock: 200, category: "معلبات", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h34/h30/34030021148702/18919_main.jpg?im=Resize=400" },
          { name: "صلصة طماطم معلبة", description: "صلصة طماطم معلبة جاهزة - 400 جم", price: "25.00", stock: 150, category: "معلبات", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h05/h34/14786096726046/185452_main.jpg?im=Resize=400" },
          { name: "ذرة معلبة صفراء", description: "ذرة صفراء معلبة طبيعية - 340 جم", price: "20.00", stock: 180, category: "معلبات", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h7d/h12/14932249477150/18916_main.jpg?im=Resize=400" },
          { name: "فاصوليا بيضاء معلبة", description: "فاصوليا بيضاء معلبة بالصلصة - 400 جم", price: "22.00", stock: 150, category: "معلبات", imageUrl: "https://cdn.mafrservices.com/sys-master-root/h66/he4/14786100297758/206198_main.jpg?im=Resize=400" },
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
