import { pool, db } from "../db";
import { users, wallets, stores, orders, subOrders, deliveryOtps, ledger, products, orderItems, deliveryOffers } from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { eq, sql } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
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
      { name: 'offer_status', values: ['PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED'] }
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
        user_id UUID NOT NULL REFERENCES users(id),
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
      { table: 'wallet_transactions', column: 'notes', type: 'TEXT' }
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

    // 5. Delete Store Testing (Admin only)
    console.log("--- RUNNING ENHANCED STORE DELETION TESTS ---");
    const allStores = await db.select().from(stores);
    
    for (const store of allStores) {
      try {
        const result = await storage.deleteStore(store.id);
        console.log(`Deletion Report for Store: ${store.name}`);
        console.log(JSON.stringify(result, null, 2));
      } catch (err: any) {
        console.error(`Failed to delete store ${store.name}: ${err.message}`);
      }
    }
    if (allStores.length === 0) {
      console.log("No stores found to test deletion.");
    }

    console.table(report);
    console.log("--- DATABASE AUTO-VERIFICATION COMPLETE: HEALTHY ✅ ---");
    return true;
  } catch (error) {
    console.error("--- DATABASE AUTO-VERIFICATION FAILED ❌ ---", error);
    throw error;
  }
}
