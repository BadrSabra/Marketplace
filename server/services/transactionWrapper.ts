import { db } from "../db";
import { wallets, ledger, auditLogs, walletTransactions } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export async function walletTransactionWrapper(
  userId: string,
  amount: string,
  type: "DEPOSIT" | "WITHDRAWAL" | "COMMISSION",
  operation: (tx: any) => Promise<any>
) {
  try {
    return await db.transaction(async (tx: any) => {
      const result = await operation(tx);
      
      // Atomic ledger entry
      await tx.insert(ledger).values({
        creditUserId: type === "DEPOSIT" ? userId : null,
        debitUserId: type === "WITHDRAWAL" ? userId : null,
        amount,
        type,
        referenceId: result.id
      });

      return result;
    });
  } catch (error: any) {
    console.error(JSON.stringify({ level: "error", message: "Transaction failed", error: error.message, userId }));
    
    // Log failure to audit logs
    await db.insert(auditLogs).values({
      actionType: "TRANSACTION_FAILURE",
      entityType: "WALLET",
      entityId: userId,
      performedByUserId: userId,
      performedByRole: "SYSTEM",
      newValue: { error: error.message, amount, type }
    });
    
    throw error;
  }
}
