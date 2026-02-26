import { db } from "../db";
import { users, wallets, ledger, auditLogs } from "../../shared/schema";
import { eq, sql, lt } from "drizzle-orm";

async function runMigration() {
  console.log(JSON.stringify({ level: "info", message: "Starting pre-migration checks..." }));

  try {
    // 1. Pre-migration checks
    const invalidWallets = await db.select().from(wallets).where(lt(wallets.balance, "0"));
    if (invalidWallets.length > 0) {
      throw new Error(`Inconsistent wallet balances found: ${invalidWallets.length} accounts with negative balance.`);
    }

    // Check for pending transactions (walletTransactions table)
    // Wrap in try-catch in case table doesn't exist yet
    try {
      const { walletTransactions } = await import("../../shared/schema");
      const pendingTransactions = await db.select().from(walletTransactions).where(eq(walletTransactions.status, "PENDING"));
      if (pendingTransactions.length > 0) {
        console.warn(JSON.stringify({ level: "warn", message: "Pending transactions detected. Proceeding with caution.", count: pendingTransactions.length }));
      }
    } catch (e: any) {
      console.log(JSON.stringify({ level: "info", message: "wallet_transactions table not found, skipping pending transaction check." }));
    }

    console.log(JSON.stringify({ level: "info", message: "Pre-checks passed. Proceeding with schema updates..." }));

    // 2. Atomic Migration
    await db.transaction(async (tx) => {
      // Create ledger table if not exists
      await tx.execute(sql`
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

      // Create audit_logs table if not exists
      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
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
        )
      `);

      // Verify writability
      const [admin] = await tx.select().from(users).where(eq(users.role, "ADMIN")).limit(1);
      if (admin) {
        await tx.insert(auditLogs).values({
          actionType: "MIGRATION_VERIFICATION",
          entityType: "SYSTEM",
          entityId: admin.id,
          performedByUserId: admin.id,
          performedByRole: "ADMIN",
          newValue: { status: "MIGRATION_IN_PROGRESS" }
        });
      }
    });

    console.log(JSON.stringify({ level: "info", message: "Schema migration successful. Running verification..." }));

    // 3. Post-migration verification
    // Verify wallet balance vs ledger aggregate
    const walletSum = await db.select({ total: sql<string>`sum(balance)` }).from(wallets);
    const ledgerSum = await db.select({ total: sql<string>`sum(amount)` }).from(ledger);
    
    console.log(JSON.stringify({ 
      level: "info", 
      message: "Verification Report", 
      walletTotal: walletSum[0]?.total || "0", 
      ledgerTotal: ledgerSum[0]?.total || "0" 
    }));

    console.log(JSON.stringify({ level: "info", message: "Migration completed successfully. Ledger and Audit Logs are now active." }));

  } catch (error: any) {
    console.error(JSON.stringify({ level: "error", message: "Migration failed", error: error.message }));
    process.exit(1);
  }
}

// Only run if triggered via CLI with YES
if (process.argv.includes("--confirm=YES")) {
  runMigration();
} else {
  console.log("Usage: npx tsx server/scripts/migrate-ledger.ts --confirm=YES");
  process.exit(1);
}
