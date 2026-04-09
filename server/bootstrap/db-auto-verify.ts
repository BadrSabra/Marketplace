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

    console.table(report);
    console.log("--- DATABASE AUTO-VERIFICATION COMPLETE: HEALTHY ✅ ---");
    return true;
  } catch (error) {
    console.error("--- DATABASE AUTO-VERIFICATION FAILED ❌ ---", error);
    throw error;
  }
}
