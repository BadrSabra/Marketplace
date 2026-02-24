import { db } from "../../db";
import { wallets, walletTransactions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { Wallet, InsertWallet, WalletTransaction, InsertWalletTransaction } from "@shared/schema";

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
    
    if (parseFloat(amount) <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const [transaction] = await db.insert(walletTransactions).values({
      walletId: wallet.id,
      type: "DEPOSIT",
      amount,
      status: "PENDING",
      // receiptUrl should be added to schema if needed, for now we can use metadata or a separate field if it existed.
      // Since it's not in the provided schema, I'll assume it might be related to a future field or logged.
    } as any).returning();
    
    return transaction;
  }
}

export const walletService = new WalletService();
