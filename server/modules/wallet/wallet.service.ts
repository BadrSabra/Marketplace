import { db } from "../../db";
import { walletTransactions, users, wallets } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { Wallet, InsertWallet, WalletTransaction, InsertWalletTransaction } from "@shared/schema";
import { notificationService } from "../notifications/notification.service";
import { ledgerService } from "../ledger/ledger.service";
import { auditService } from "../../services/auditService";

export class WalletService {
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    const [existing] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    if (existing) return existing;

    const [newWallet] = await db.insert(wallets).values({
      userId,
      balance: "0.00"
    }).returning();
    return newWallet;
  }

  async getBalance(userId: string): Promise<string> {
    const wallet = await this.getOrCreateWallet(userId);
    return wallet.balance;
  }

  async createDeposit(userId: string, amount: string, receiptUrl: string): Promise<WalletTransaction> {
    const wallet = await this.getOrCreateWallet(userId);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (parseFloat(amount) <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const [transaction] = await db.insert(walletTransactions).values({
      walletId: wallet.id,
      type: "DEPOSIT",
      amount,
      status: "PENDING",
    } as any).returning();

    if (user) {
      await notificationService.notifyDepositSubmitted(user.email, amount);
    }
    
    return transaction;
  }

  async getPendingDeposits(): Promise<any[]> {
    return await db.select({
      transaction: walletTransactions,
      user: users
    })
    .from(walletTransactions)
    .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
    .innerJoin(users, eq(wallets.userId, users.id))
    .where(and(
      eq(walletTransactions.type, "DEPOSIT"),
      eq(walletTransactions.status, "PENDING")
    ));
  }

  async approveDeposit(transactionId: string): Promise<WalletTransaction> {
    return await db.transaction(async (tx) => {
      const [transaction] = await tx.select()
        .from(walletTransactions)
        .where(eq(walletTransactions.id, transactionId));

      if (!transaction || transaction.type !== "DEPOSIT" || transaction.status !== "PENDING") {
        throw new Error("Invalid or already processed deposit");
      }

      const [wallet] = await tx.select()
        .from(wallets)
        .where(eq(wallets.id, transaction.walletId));

      if (!wallet) throw new Error("Wallet not found");

      const [user] = await tx.select()
        .from(users)
        .where(eq(users.id, wallet.userId));

      // Update wallet balance using ledger service approach (but for deposit)
      const oldBalance = wallet.balance;
      const newBalance = (parseFloat(wallet.balance) + parseFloat(transaction.amount)).toFixed(2);
      
      await tx.update(wallets)
        .set({ balance: newBalance })
        .where(eq(wallets.id, wallet.id));

      const [updatedTransaction] = await tx.update(walletTransactions)
        .set({ status: "COMPLETED" })
        .where(eq(walletTransactions.id, transactionId))
        .returning();

      // Log audit for deposit approval
      await auditService.logEvent({
        actionType: "DEPOSIT_APPROVED",
        entityType: "wallet_transaction",
        entityId: transactionId,
        performedByUserId: user?.id || wallet.userId,
        performedByRole: user?.role || "ADMIN",
        oldValue: { balance: oldBalance },
        newValue: { balance: newBalance },
        metadata: { amount: transaction.amount, walletId: wallet.id }
      });

      if (user) {
        await notificationService.notifyDepositApproved(user.email, transaction.amount);
      }

      return updatedTransaction;
    });
  }
}

export const walletService = new WalletService();
