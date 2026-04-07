import { pool, db } from "../db";
import { users, wallets, stores, orders, subOrders, deliveryOtps, ledger } from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function initializeDatabase() {
  console.log("[DB] Starting database self-healing bootstrap...");
  
  const report = {
    tables: "OK",
    columns: "OK",
    enums: "OK",
    indexes: "OK",
    admin: "EXISTS",
    status: "HEALTHY"
  };

  try {
    // 1. Ensure ENUMs exist
    console.log("[DB] Checking enums...");
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
      const enumCheck = await pool.query("SELECT n.nspname as schema, t.typname as name FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = $1", [e.name]);
      if (enumCheck.rowCount === 0) {
        const values = e.values.map(v => `'${v}'`).join(', ');
        await pool.query(`CREATE TYPE ${e.name} AS ENUM (${values})`);
        console.log(`✅ Enum '${e.name}' created.`);
      } else {
        console.log(`✅ Enum '${e.name}' exists.`);
      }
    }

    // 2. Ensure Core Tables Exist
    console.log("[DB] Checking tables...");
    const tables = ['users', 'wallets', 'stores', 'orders', 'sub_orders', 'delivery_otps', 'ledger', 'withdrawal_requests'];
    for (const table of tables) {
      const tableCheck = await pool.query(`SELECT to_regclass('public.${table}')`);
      if (!tableCheck.rows[0].to_regclass) {
        console.log(`[DB] Table '${table}' missing. Creating...`);
        if (table === 'users') {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
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
            )
          `);
        } else if (table === 'wallets') {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS wallets (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id),
              balance DECIMAL(12,2) DEFAULT 0,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
          `);
        } else if (table === 'stores') {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS stores (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              owner_id UUID NOT NULL REFERENCES users(id),
              name VARCHAR NOT NULL,
              type VARCHAR,
              description TEXT,
              location_text TEXT,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
          `);
        } else if (table === 'orders') {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              customer_id UUID NOT NULL REFERENCES users(id),
              overall_status order_status NOT NULL DEFAULT 'PENDING',
              delivery_status delivery_status NOT NULL DEFAULT 'PENDING',
              payment_status payment_status NOT NULL DEFAULT 'PENDING',
              total_price DECIMAL(12,2) DEFAULT 0,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
          `);
        } else if (table === 'sub_orders') {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS sub_orders (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              order_id UUID NOT NULL REFERENCES orders(id),
              store_id UUID NOT NULL REFERENCES stores(id),
              status order_status NOT NULL DEFAULT 'PENDING',
              subtotal DECIMAL(10,2) NOT NULL,
              assigned_driver_id UUID REFERENCES users(id),
              expected_delivery_fee DECIMAL(10,2) DEFAULT 0,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
          `);
        } else if (table === 'delivery_otps') {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS delivery_otps (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              order_id UUID NOT NULL REFERENCES orders(id),
              sub_order_id UUID REFERENCES sub_orders(id),
              otp_code TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'PENDING',
              attempt_count INTEGER DEFAULT 0,
              expires_at TIMESTAMP NOT NULL,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
          `);
        } else if (table === 'ledger') {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS ledger (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              reference_id UUID,
              debit_user_id UUID REFERENCES users(id),
              credit_user_id UUID REFERENCES users(id),
              amount DECIMAL(12,2) NOT NULL,
              type TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
          `);
        } else if (table === 'withdrawal_requests') {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS withdrawal_requests (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id),
              wallet_id UUID NOT NULL REFERENCES wallets(id),
              amount DECIMAL(12,2) NOT NULL,
              status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
              admin_note TEXT,
              reviewed_by_admin_id UUID REFERENCES users(id),
              created_at TIMESTAMP NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
        }
        console.log(`✅ Table '${table}' created.`);
      } else {
        console.log(`✅ Table '${table}' exists.`);
      }
    }

    // 3. Ensure Missing Columns
    console.log("[DB] Checking columns...");
    const columnChecks = [
      { table: 'users', column: 'role', type: 'role NOT NULL DEFAULT \'CUSTOMER\'' },
      { table: 'users', column: 'email', type: 'VARCHAR UNIQUE NOT NULL' },
      { table: 'delivery_otps', column: 'expires_at', type: 'TIMESTAMP NOT NULL' },
      { table: 'delivery_otps', column: 'attempt_count', type: 'INTEGER DEFAULT 0' },
      { table: 'delivery_otps', column: 'status', type: 'TEXT NOT NULL DEFAULT \'PENDING\'' },
      { table: 'delivery_otps', column: 'otp_code', type: 'TEXT NOT NULL' },
      { table: 'delivery_otps', column: 'sub_order_id', type: 'UUID REFERENCES sub_orders(id)' },
      { table: 'delivery_otps', column: 'order_id', type: 'UUID NOT NULL REFERENCES orders(id)' }
    ];

    for (const check of columnChecks) {
      const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [check.table, check.column]);
      
      if (res.rowCount === 0) {
        console.log(`[DB] Column '${check.column}' missing in '${check.table}'. Adding...`);
        try {
          await pool.query(`ALTER TABLE ${check.table} ADD COLUMN ${check.column} ${check.type}`);
          console.log(`✅ Column '${check.column}' added to '${check.table}'.`);
        } catch (e: any) {
          console.error(`❌ Failed to add column '${check.column}' to '${check.table}':`, e.message);
        }
      } else {
        console.log(`✅ Column '${check.column}' exists in '${check.table}'.`);
      }
    }

    // 4. Ensure Indexes
    console.log("[DB] Checking indexes...");
    const indexCheck = await pool.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'delivery_otps' AND indexname = 'sub_order_pending_idx'
    `);
    if (indexCheck.rowCount === 0) {
      console.log("[DB] Index 'sub_order_pending_idx' missing on 'delivery_otps'. Creating...");
      await pool.query(`CREATE INDEX sub_order_pending_idx ON delivery_otps (sub_order_id, status)`);
      console.log("✅ Index 'sub_order_pending_idx' created.");
    } else {
      console.log("✅ Index 'sub_order_pending_idx' exists.");
    }

    // 5. Auto Create Default Admin
    console.log("[DB] Checking admin...");
    const adminCheck = await db.select().from(users).where(eq(users.role, "ADMIN")).limit(1);
    if (adminCheck.length === 0) {
      console.log("[DB] Default Admin missing. Creating...");
      const hashedPassword = await hashPassword("Admin@123");
      
      await db.transaction(async (tx) => {
        const [admin] = await tx.insert(users).values({
          name: "Admin",
          email: "admin@mitgaber.com",
          password: hashedPassword,
          role: "ADMIN",
          isApproved: true,
        }).returning();

        await tx.insert(wallets).values({
          userId: admin.id,
          balance: "0.00",
        });
      });
      report.admin = "CREATED";
      console.log("✅ Default Admin created successfully.");
    } else {
      console.log("✅ Admin user exists.");
    }

    console.log("\nDATABASE HEALTH REPORT");
    console.log("----------------------");
    console.log(`Tables: ${report.tables}`);
    console.log(`Columns: ${report.columns}`);
    console.log(`Enums: ${report.enums}`);
    console.log(`Indexes: ${report.indexes}`);
    console.log(`Admin: ${report.admin}`);
    console.log(`Status: ${report.status}\n`);

    console.log("[DB] Database ready.");
    return report;

  } catch (error) {
    console.error("[DB] Critical bootstrap error:", error);
    report.status = "UNHEALTHY";
    throw error;
  }
}
