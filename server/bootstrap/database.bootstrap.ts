import { pool, db } from "../db";
import { users, wallets, stores, roleEnum } from "@shared/schema";
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
    admin: "EXISTS",
    status: "HEALTHY"
  };

  try {
    // 1. Ensure ENUMs exist
    console.log("[DB] Checking enums...");
    const enumCheck = await pool.query("SELECT n.nspname as schema, t.typname as name FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'role'");
    if (enumCheck.rowCount === 0) {
      await pool.query("CREATE TYPE role AS ENUM ('ADMIN', 'CUSTOMER', 'STORE_OWNER', 'DRIVER')");
      console.log("[DB] Enum 'role' created.");
    }

    // 2. Ensure Core Tables Exist
    console.log("[DB] Checking tables...");
    const tables = ['users', 'wallets', 'stores'];
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
        }
      }
    }

    // 3. Ensure Missing Columns
    console.log("[DB] Checking columns...");
    const columnChecks = [
      { table: 'users', column: 'transport_type', type: 'VARCHAR' },
      { table: 'users', column: 'avatar_url', type: 'TEXT' },
      { table: 'users', column: 'addresses', type: 'JSONB DEFAULT \'[]\'' },
      { table: 'stores', column: 'description', type: 'TEXT' },
      { table: 'stores', column: 'location_text', type: 'TEXT' }
    ];

    for (const check of columnChecks) {
      const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [check.table, check.column]);
      
      if (res.rowCount === 0) {
        console.log(`[DB] Column '${check.column}' missing in '${check.table}'. Adding...`);
        await pool.query(`ALTER TABLE ${check.table} ADD COLUMN ${check.column} ${check.type}`);
      }
    }

    // 4. Auto Create Default Admin
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
      console.log("[DB] Default Admin created successfully.");
    }

    console.log("\nDATABASE HEALTH REPORT");
    console.log("----------------------");
    console.log(`Tables: ${report.tables}`);
    console.log(`Columns: ${report.columns}`);
    console.log(`Enums: ${report.enums}`);
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
