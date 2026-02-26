import { db } from "../../db";
import { wallets, walletTransactions } from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";
import type { WalletTransaction, InsertWalletTransaction } from "@shared/schema";
import { auditService } from "../../services/auditService";

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

      const oldBalance = wallet.balance;
      const newBalance = (parseFloat(wallet.balance) - parseFloat(amount)).toFixed(2);

      // 2. Update wallet balance
      await tx.update(wallets)
        .set({ 
          balance: newBalance,
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

      // Log audit for wallet update (hold)
      await auditService.logEvent({
        actionType: "WALLET_UPDATE",
        entityType: "wallet",
        entityId: walletId,
        performedByUserId: wallet.userId,
        performedByRole: "SYSTEM",
        oldValue: { balance: oldBalance },
        newValue: { balance: newBalance },
        metadata: { action: "HOLD", amount, relatedOrderId }
      });

      return transaction;
    });
  }

  /**
   * Releases previously held funds.
   */
  async releaseFunds(walletId: string, amount: string, relatedOrderId?: string): Promise<WalletTransaction> {
    if (parseFloat(amount) <= 0) throw new Error("Amount must be greater than 0");

    return await db.transaction(async (tx) => {
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.id, walletId));
      if (!wallet) throw new Error("Wallet not found");

      const oldBalance = wallet.balance;
      const newBalance = (parseFloat(wallet.balance) + parseFloat(amount)).toFixed(2);

      // 1. Update wallet balance
      await tx.update(wallets)
        .set({ 
          balance: newBalance,
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

      // Log audit for wallet update (release)
      await auditService.logEvent({
        actionType: "WALLET_UPDATE",
        entityType: "wallet",
        entityId: walletId,
        performedByUserId: wallet.userId,
        performedByRole: "SYSTEM",
        oldValue: { balance: oldBalance },
        newValue: { balance: newBalance },
        metadata: { action: "RELEASE", amount, relatedOrderId }
      });

      return transaction;
    });
  }

  /**
   * Adds commission to a wallet.
   */
  async addCommission(walletId: string, amount: string, relatedOrderId?: string): Promise<WalletTransaction> {
    if (parseFloat(amount) <= 0) throw new Error("Amount must be greater than 0");

    return await db.transaction(async (tx) => {
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.id, walletId));
      if (!wallet) throw new Error("Wallet not found");

      const oldBalance = wallet.balance;
      const newBalance = (parseFloat(wallet.balance) + parseFloat(amount)).toFixed(2);

      await tx.update(wallets)
        .set({ 
          balance: newBalance,
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

      // Log audit for commission processed
      await auditService.logEvent({
        actionType: "COMMISSION_PROCESSED",
        entityType: "wallet",
        entityId: walletId,
        performedByUserId: wallet.userId,
        performedByRole: "SYSTEM",
        oldValue: { balance: oldBalance },
        newValue: { balance: newBalance },
        metadata: { amount, relatedOrderId }
      });

      return transaction;
    });
  }

  /**
   * Refunds funds to a wallet.
   */
  async refundFunds(walletId: string, amount: string, relatedOrderId?: string): Promise<WalletTransaction> {
    if (parseFloat(amount) <= 0) throw new Error("Amount must be greater than 0");

    return await db.transaction(async (tx) => {
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.id, walletId));
      if (!wallet) throw new Error("Wallet not found");

      const oldBalance = wallet.balance;
      const newBalance = (parseFloat(wallet.balance) + parseFloat(amount)).toFixed(2);

      await tx.update(wallets)
        .set({ 
          balance: newBalance,
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

      // Log audit for wallet update (refund)
      await auditService.logEvent({
        actionType: "WALLET_UPDATE",
        entityType: "wallet",
        entityId: walletId,
        performedByUserId: wallet.userId,
        performedByRole: "SYSTEM",
        oldValue: { balance: oldBalance },
        newValue: { balance: newBalance },
        metadata: { action: "REFUND", amount, relatedOrderId }
      });

      return transaction;
    });
  }

  /**
   * Processes commission distribution after a successful delivery.
   */
  async processCommissions(subOrderId: string, orderId: string): Promise<void> {
    const { subOrders, orders, stores, users, wallets, deliveryOffers } = await import("@shared/schema");
    const { notificationService } = await import("../notifications/notification.service");
    const { auditService } = await import("../../services/auditService");

    await db.transaction(async (tx) => {
      // 1. Get SubOrder details
      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, subOrderId));
      if (!subOrder) throw new Error("SubOrder not found");

      // 2. Get Order details
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
      if (!order) throw new Error("Order not found");

      // 3. Get Store details
      const [store] = await tx.select().from(stores).where(eq(stores.id, subOrder.storeId));
      if (!store) throw new Error("Store not found");

      // 4. Calculate commissions (1% each)
      const subtotal = parseFloat(subOrder.subtotal);
      const commissionAmount = (subtotal * 0.01).toFixed(2);

      // 5. Identify parties
      const customerId = order.customerId;
      const storeOwnerId = store.ownerId;
      
      // Get driver from accepted delivery offer
      const [deliveryOffer] = await tx.select()
        .from(deliveryOffers)
        .where(and(eq(deliveryOffers.subOrderId, subOrderId), eq(deliveryOffers.status, "ACCEPTED")));
      const driverId = deliveryOffer?.driverId;

      // Helper to update balance and record ledger
      const distribute = async (userId: string, type: "COMMISSION", label: string) => {
        if (!userId) return;
        const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId));
        if (!wallet) return;

        const oldBalance = wallet.balance;
        const newBalance = (parseFloat(wallet.balance) + parseFloat(commissionAmount)).toFixed(2);

        await tx.update(wallets)
          .set({ balance: newBalance, updatedAt: new Date() })
          .where(eq(wallets.id, wallet.id));

        await tx.insert(walletTransactions).values({
          walletId: wallet.id,
          type,
          amount: commissionAmount,
          relatedOrderId: orderId,
          status: "COMPLETED",
        });

        // Log audit for commission processed
        await auditService.logEvent({
          actionType: "COMMISSION_PROCESSED",
          entityType: "wallet",
          entityId: wallet.id,
          performedByUserId: userId,
          performedByRole: "SYSTEM",
          oldValue: { balance: oldBalance },
          newValue: { balance: newBalance },
          metadata: { amount: commissionAmount, relatedOrderId: orderId, party: label }
        });

        const [user] = await tx.select().from(users).where(eq(users.id, userId));
        if (user) {
          await notificationService.sendEmail(
            user.email,
            "Commission Received",
            `You have received a commission of ${commissionAmount} for order ${orderId} (${label}).`
          );
        }
      };

      // Distribute to Customer, Store Owner, and Driver
      await distribute(customerId, "COMMISSION", "Customer");
      await distribute(storeOwnerId, "COMMISSION", "Store Owner");
      if (driverId) {
        await distribute(driverId, "COMMISSION", "Driver");
      }
      
      // Platform commission would typically stay in a platform wallet, here we just track ledger or assume it's handled.
    });
  }
}

export const ledgerService = new LedgerService();

export const ledgerService = new LedgerService();
