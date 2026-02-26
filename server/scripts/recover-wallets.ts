import { db } from "../db";
import { wallets, ledger, auditLogs } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

async function recoverWallets() {
  console.log(JSON.stringify({ level: "info", message: "Starting wallet recovery from ledger..." }));

  try {
    const usersWithLedger = await db.selectDistinct({ userId: ledger.creditUserId }).from(ledger);
    const debitUsers = await db.selectDistinct({ userId: ledger.debitUserId }).from(ledger);
    
    const allUserIds = new Set([
      ...usersWithLedger.map(u => u.userId).filter(Boolean),
      ...debitUsers.map(u => u.userId).filter(Boolean)
    ]);

    for (const userId of allUserIds) {
      if (!userId) continue;

      await db.transaction(async (tx) => {
        const creditSum = await tx.select({ total: sql<string>`sum(amount)` }).from(ledger).where(eq(ledger.creditUserId, userId));
        const debitSum = await tx.select({ total: sql<string>`sum(amount)` }).from(ledger).where(eq(ledger.debitUserId, userId));

        const balance = parseFloat(creditSum[0]?.total || "0") - parseFloat(debitSum[0]?.total || "0");
        const formattedBalance = balance.toFixed(2);

        const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for("update");
        
        if (wallet && wallet.balance !== formattedBalance) {
          console.log(JSON.stringify({ level: "info", message: "Reconciling wallet", userId, oldBalance: wallet.balance, newBalance: formattedBalance }));
          
          await tx.update(wallets).set({ balance: formattedBalance, updatedAt: new Date() }).where(eq(wallets.userId, userId));
          
          await tx.insert(auditLogs).values({
            actionType: "RECOVERY_ACTION",
            entityType: "WALLET",
            entityId: wallet.id,
            performedByUserId: userId, // In script context, using target user or system admin ID
            performedByRole: "SYSTEM",
            oldValue: { balance: wallet.balance },
            newValue: { balance: formattedBalance },
            metadata: { reason: "Ledger reconciliation" }
          });
        }
      });
    }

    console.log(JSON.stringify({ level: "info", message: "Recovery completed successfully." }));
  } catch (error: any) {
    console.error(JSON.stringify({ level: "error", message: "Recovery failed", error: error.message }));
    process.exit(1);
  }
}

recoverWallets();
