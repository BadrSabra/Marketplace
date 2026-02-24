import { db } from "../../db";
import { wallets, walletTransactions } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { WalletTransaction, InsertWalletTransaction } from "@shared/schema";

export class LedgerService {
  /**
   * Holds funds in a wallet by creating a PENDING transaction and decrementing balance.
   * In a real system, 'HOLD' might just mark the balance as 'unavailable'.
   * For this phase, we'll follow the requirement to create a transaction and ensure atomicity.
   */
  async holdFunds(walletId: string, amount: string, relatedOrderId?: string): Promise<WalletTransaction> {
    if (parseFloat(amount) <= 0) throw new Error("Amount must be greater than 0");

    return await db.transaction(async (tx) => {
      // 1. Check balance
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.id, walletId));
      if (!wallet || parseFloat(wallet.balance) < parseFloat(amount)) {
        throw new Error("Insufficient funds");
      }

      // 2. Update wallet balance
      await tx.update(wallets)
        .set({ 
          balance: sql`${wallets.balance} - ${amount}`,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, walletId));

      // 3. Create ledger entry
      const [transaction] = await tx.insert(walletTransactions).values({
        walletId,
        type: "HOLD",
        amount,
        relatedOrderId,
        status: "PENDING",
      }).returning();

      return transaction;
    });
  }

  /**
   * Releases previously held funds.
   */
  async releaseFunds(walletId: string, amount: string, relatedOrderId?: string): Promise<WalletTransaction> {
    if (parseFloat(amount) <= 0) throw new Error("Amount must be greater than 0");

    return await db.transaction(async (tx) => {
      // 1. Update wallet balance
      await tx.update(wallets)
        .set({ 
          balance: sql`${wallets.balance} + ${amount}`,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, walletId));

      // 2. Create ledger entry
      const [transaction] = await tx.insert(walletTransactions).values({
        walletId,
        type: "RELEASE",
        amount,
        relatedOrderId,
        status: "COMPLETED",
      }).returning();

      return transaction;
    });
  }

  /**
   * Adds commission to a wallet.
   */
  async addCommission(walletId: string, amount: string, relatedOrderId?: string): Promise<WalletTransaction> {
    if (parseFloat(amount) <= 0) throw new Error("Amount must be greater than 0");

    return await db.transaction(async (tx) => {
      await tx.update(wallets)
        .set({ 
          balance: sql`${wallets.balance} + ${amount}`,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, walletId));

      const [transaction] = await tx.insert(walletTransactions).values({
        walletId,
        type: "COMMISSION",
        amount,
        relatedOrderId,
        status: "COMPLETED",
      }).returning();

      return transaction;
    });
  }

  /**
   * Refunds funds to a wallet.
   */
  async refundFunds(walletId: string, amount: string, relatedOrderId?: string): Promise<WalletTransaction> {
    if (parseFloat(amount) <= 0) throw new Error("Amount must be greater than 0");

    return await db.transaction(async (tx) => {
      await tx.update(wallets)
        .set({ 
          balance: sql`${wallets.balance} + ${amount}`,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, walletId));

      const [transaction] = await tx.insert(walletTransactions).values({
        walletId,
        type: "REFUND",
        amount,
        relatedOrderId,
        status: "COMPLETED",
      }).returning();

      return transaction;
    });
  }
}

export const ledgerService = new LedgerService();
