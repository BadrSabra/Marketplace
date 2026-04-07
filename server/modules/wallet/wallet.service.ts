import { db } from "../../db";
import { walletTransactions, users, wallets, ledger, withdrawalRequests } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { Wallet, InsertWallet, WalletTransaction, InsertWalletTransaction, WithdrawalRequest } from "@shared/schema";
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
      receiptUrl,
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
        .where(eq(walletTransactions.id, transactionId))
        .for("update");

      if (!transaction || transaction.type !== "DEPOSIT" || transaction.status !== "PENDING") {
        throw new Error("Invalid or already processed deposit");
      }

      const [wallet] = await tx.select()
        .from(wallets)
        .where(eq(wallets.id, transaction.walletId))
        .for("update");

      if (!wallet) throw new Error("Wallet not found");

      const [user] = await tx.select()
        .from(users)
        .where(eq(users.id, wallet.userId));

      // 1️⃣ WALLET PROTECTION LAYER: Prevent Negative Balance
      const amountNum = parseFloat(transaction.amount);
      const oldBalanceNum = parseFloat(wallet.balance);
      
      if (amountNum < 0) {
        throw new Error("BUSINESS_RULE_VIOLATION: Negative deduction amount not allowed");
      }

      const newBalanceNum = oldBalanceNum + amountNum;

      if (newBalanceNum < 0) {
        throw new Error("BUSINESS_RULE_VIOLATION: Insufficient wallet balance");
      }

      const newBalance = newBalanceNum.toFixed(2);
      
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
        oldValue: { balance: wallet.balance },
        newValue: { balance: newBalance },
        metadata: { amount: transaction.amount, walletId: wallet.id }
      });

      if (user) {
        await notificationService.notifyDepositApproved(user.email, transaction.amount);
      }

      return updatedTransaction;
    });
  }

  async adminOverride(walletId: string, amount: string, reason: string, actorId: string): Promise<string> {
    const amountNum = parseFloat(amount);
    if (amountNum === 0) {
      throw new Error("BAD_REQUEST: Override amount cannot be zero");
    }

    return await db.transaction(async (tx) => {
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.id, walletId)).for("update");
      if (!wallet) {
        throw new Error("NOT_FOUND: Wallet not found");
      }

      const [actor] = await tx.select().from(users).where(eq(users.id, actorId));
      if (!actor || actor.role !== "ADMIN") {
        throw new Error("FORBIDDEN: Only admins can perform overrides");
      }

      const oldBalanceNum = parseFloat(wallet.balance);
      const newBalanceNum = oldBalanceNum + amountNum;

      if (newBalanceNum < 0) {
        throw new Error("BUSINESS_RULE_VIOLATION: Override would result in negative balance");
      }

      const newBalance = newBalanceNum.toFixed(2);

      // Update Wallet
      await tx.update(wallets)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(wallets.id, walletId));

      // Update Ledger (only if table exists)
      try {
        const tableCheck = await tx.execute(sql`SELECT 1 FROM information_schema.tables WHERE table_name = 'ledger'`);
        if (tableCheck.rowCount > 0) {
          await tx.insert(ledger).values({
            referenceId: null,
            creditUserId: amountNum > 0 ? wallet.userId : null,
            debitUserId: amountNum < 0 ? wallet.userId : null,
            amount: Math.abs(amountNum).toFixed(2),
            type: amountNum > 0 ? "DEPOSIT" : "WITHDRAWAL",
          });
        }
      } catch (e) {
        console.warn("Ledger table check or update failed");
      }

      // Log Audit
      try {
        const tableCheck = await tx.execute(sql`SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs'`);
        if (tableCheck.rowCount > 0) {
          await auditService.logEvent({
            actionType: "ADMIN_OVERRIDE",
            entityType: "wallet",
            entityId: walletId,
            performedByUserId: actorId,
            performedByRole: "ADMIN",
            oldValue: { balance: wallet.balance },
            newValue: { balance: newBalance },
            metadata: { 
              amount, 
              reason,
              amountChanged: amount,
              targetWalletId: walletId
            }
          });
        }
      } catch (e) {
        console.warn("Audit logs table check or update failed");
      }

      return newBalance;
    });
  }

  async withdraw(userId: string, amount: string): Promise<WithdrawalRequest> {
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      throw new Error("BUSINESS_RULE_VIOLATION: Amount must be a positive number");
    }

    return await db.transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(userId);
      const [lockedWallet] = await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).for("update");

      if (!lockedWallet) throw new Error("NOT_FOUND: Wallet not found");

      const currentBalance = parseFloat(lockedWallet.balance);
      if (currentBalance < withdrawAmount) {
        throw new Error("BUSINESS_RULE_VIOLATION: Insufficient wallet balance");
      }

      // Check if there's already a pending withdrawal request
      const [existingPending] = await tx.select()
        .from(withdrawalRequests)
        .where(and(eq(withdrawalRequests.userId, userId), eq(withdrawalRequests.status, "PENDING")));
      if (existingPending) {
        throw new Error("BUSINESS_RULE_VIOLATION: لديك طلب سحب معلق بالفعل، يرجى انتظار موافقة المشرف");
      }

      // Reserve funds immediately (deduct from wallet)
      const newBalance = (currentBalance - withdrawAmount).toFixed(2);
      await tx.update(wallets)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(wallets.id, lockedWallet.id));

      // Create a pending withdrawal request
      const [request] = await tx.insert(withdrawalRequests).values({
        userId,
        walletId: lockedWallet.id,
        amount: withdrawAmount.toFixed(2),
        status: "PENDING",
      }).returning();

      await auditService.logEvent({
        actionType: "WITHDRAWAL_REQUEST_CREATED",
        entityType: "withdrawal_request",
        entityId: request.id,
        performedByUserId: userId,
        performedByRole: "DRIVER",
        oldValue: { balance: lockedWallet.balance },
        newValue: { balance: newBalance },
        metadata: { amount }
      });

      return request;
    });
  }

  async getPendingWithdrawals(): Promise<any[]> {
    return await db.select({
      request: withdrawalRequests,
      user: users,
    })
    .from(withdrawalRequests)
    .innerJoin(users, eq(withdrawalRequests.userId, users.id))
    .where(eq(withdrawalRequests.status, "PENDING"));
  }

  async approveWithdrawal(requestId: string, adminId: string): Promise<WithdrawalRequest> {
    return await db.transaction(async (tx) => {
      const [request] = await tx.select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.id, requestId))
        .for("update");

      if (!request || request.status !== "PENDING") {
        throw new Error("INVALID: طلب السحب غير موجود أو تمت معالجته مسبقاً");
      }

      // Record in ledger (funds were already deducted from wallet on request creation)
      await tx.insert(ledger).values({
        referenceId: request.id,
        debitUserId: request.userId,
        creditUserId: null,
        amount: request.amount,
        type: "WITHDRAWAL",
      });

      const [updatedRequest] = await tx.update(withdrawalRequests)
        .set({ status: "APPROVED", reviewedByAdminId: adminId, updatedAt: new Date() })
        .where(eq(withdrawalRequests.id, requestId))
        .returning();

      await auditService.logEvent({
        actionType: "WITHDRAWAL_APPROVED",
        entityType: "withdrawal_request",
        entityId: requestId,
        performedByUserId: adminId,
        performedByRole: "ADMIN",
        oldValue: { status: "PENDING" },
        newValue: { status: "APPROVED" },
        metadata: { amount: request.amount, userId: request.userId }
      });

      return updatedRequest;
    });
  }

  async rejectWithdrawal(requestId: string, adminId: string, note?: string): Promise<WithdrawalRequest> {
    return await db.transaction(async (tx) => {
      const [request] = await tx.select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.id, requestId))
        .for("update");

      if (!request || request.status !== "PENDING") {
        throw new Error("INVALID: طلب السحب غير موجود أو تمت معالجته مسبقاً");
      }

      // Refund the reserved amount back to the wallet
      const [wallet] = await tx.select()
        .from(wallets)
        .where(eq(wallets.id, request.walletId))
        .for("update");

      if (wallet) {
        const refundedBalance = (parseFloat(wallet.balance) + parseFloat(request.amount)).toFixed(2);
        await tx.update(wallets)
          .set({ balance: refundedBalance, updatedAt: new Date() })
          .where(eq(wallets.id, wallet.id));
      }

      const [updatedRequest] = await tx.update(withdrawalRequests)
        .set({ status: "REJECTED", reviewedByAdminId: adminId, adminNote: note || null, updatedAt: new Date() })
        .where(eq(withdrawalRequests.id, requestId))
        .returning();

      await auditService.logEvent({
        actionType: "WITHDRAWAL_REJECTED",
        entityType: "withdrawal_request",
        entityId: requestId,
        performedByUserId: adminId,
        performedByRole: "ADMIN",
        oldValue: { status: "PENDING" },
        newValue: { status: "REJECTED" },
        metadata: { amount: request.amount, userId: request.userId, note }
      });

      return updatedRequest;
    });
  }

  async deductBalance(userId: string, amount: string, referenceId?: string): Promise<void> {
    const deductAmount = parseFloat(amount);
    if (deductAmount < 0) {
      throw new Error("BUSINESS_RULE_VIOLATION: Negative deduction amount not allowed");
    }
    if (deductAmount === 0) return;

    await db.transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(userId);
      const [lockedWallet] = await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).for("update");
      
      if (!lockedWallet) {
        throw new Error("NOT_FOUND: Wallet not found");
      }

      const currentBalance = parseFloat(lockedWallet.balance);

      if (currentBalance < deductAmount) {
        throw new Error("BUSINESS_RULE_VIOLATION: Insufficient wallet balance");
      }

      const newBalance = (currentBalance - deductAmount).toFixed(2);

      await tx.update(wallets)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(wallets.id, lockedWallet.id));

      await auditService.logEvent({
        actionType: "WALLET_DEDUCTION",
        entityType: "wallet",
        entityId: lockedWallet.id,
        performedByUserId: userId,
        performedByRole: "SYSTEM",
        oldValue: { balance: lockedWallet.balance },
        newValue: { balance: newBalance },
        metadata: { amount, referenceId }
      });
    });
  }
}

export const walletService = new WalletService();
