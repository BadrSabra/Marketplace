import { db } from "../../db";
import { ledger, subOrders, wallets, stores, users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { auditService } from "../../services/auditService";

export class LedgerService {
  async processCommissions(subOrderId: string, force = false): Promise<{ ledger_entry_ids: string[] }> {
    console.log(`[AUDIT-LEDGER] sub_order_id=${subOrderId} force=${force}`);

    return await db.transaction(async (tx) => {
      // 1. Lock sub-order row for concurrency protection
      const [subOrder] = await tx
        .select()
        .from(subOrders)
        .where(eq(subOrders.id, subOrderId))
        .for("update");

      if (!subOrder) {
        throw new Error("SUB_ORDER_NOT_FOUND");
      }

      // 2. Verify status
      if (!force && subOrder.status !== "DELIVERED") {
        throw new Error("INVALID_STATUS");
      }

      // 3. Check for existing commission
      const [existingLedger] = await tx
        .select()
        .from(ledger)
        .where(
          and(
            eq(ledger.referenceId, subOrderId),
            eq(ledger.type, "COMMISSION")
          )
        );

      if (existingLedger) {
        throw new Error("ALREADY_PROCESSED");
      }

      // 4. Fetch store details
      const [store] = await tx.select().from(stores).where(eq(stores.id, subOrder.storeId));
      if (!store) throw new Error("STORE_NOT_FOUND");

      const subtotalNum = parseFloat(subOrder.subtotal.toString());
      const deliveryFeeNum = parseFloat(subOrder.expectedDeliveryFee.toString());

      if (subtotalNum < 0 || deliveryFeeNum < 0) {
        throw new Error("INVALID_AMOUNTS");
      }

      // 5. Calculate commissions
      // Platform: 1% of subtotal
      const platformCommission = subtotalNum * 0.01;
      const storeAmount = subtotalNum - platformCommission;
      const driverAmount = deliveryFeeNum;

      const ledgerEntries: string[] = [];

      // 6. Process Store Commission
      const [storeLedger] = await tx.insert(ledger).values({
        referenceId: subOrderId,
        creditUserId: store.ownerId,
        amount: storeAmount.toString(),
        type: "COMMISSION",
      }).returning();
      ledgerEntries.push(storeLedger.id);

      // Update Store Wallet
      const [storeWallet] = await tx.select().from(wallets).where(eq(wallets.userId, store.ownerId));
      if (storeWallet) {
        const oldBalance = storeWallet.balance;
        const newBalance = (parseFloat(oldBalance) + storeAmount).toFixed(2);
        
        await tx.update(wallets)
          .set({ 
            balance: newBalance,
            updatedAt: new Date()
          })
          .where(eq(wallets.id, storeWallet.id));

        await auditService.logEvent({
          actionType: "COMMISSION_PROCESSED",
          entityType: "wallet",
          entityId: storeWallet.id,
          performedByUserId: store.ownerId,
          performedByRole: "SYSTEM",
          oldValue: { balance: oldBalance },
          newValue: { balance: newBalance },
          metadata: { subOrderId, amount: storeAmount.toString(), type: "STORE" }
        });
      }

      // 7. Process Driver Commission (if assigned)
      if (subOrder.assignedDriverId) {
        const [driverLedger] = await tx.insert(ledger).values({
          referenceId: subOrderId,
          creditUserId: subOrder.assignedDriverId,
          amount: driverAmount.toString(),
          type: "COMMISSION",
        }).returning();
        ledgerEntries.push(driverLedger.id);

        const [driverWallet] = await tx.select().from(wallets).where(eq(wallets.userId, subOrder.assignedDriverId));
        if (driverWallet) {
          const oldBalance = driverWallet.balance;
          const newBalance = (parseFloat(oldBalance) + driverAmount).toFixed(2);

          await tx.update(wallets)
            .set({ 
              balance: newBalance,
              updatedAt: new Date()
            })
            .where(eq(wallets.id, driverWallet.id));

          await auditService.logEvent({
            actionType: "COMMISSION_PROCESSED",
            entityType: "wallet",
            entityId: driverWallet.id,
            performedByUserId: subOrder.assignedDriverId,
            performedByRole: "SYSTEM",
            oldValue: { balance: oldBalance },
            newValue: { balance: newBalance },
            metadata: { subOrderId, amount: driverAmount.toString(), type: "DRIVER" }
          });
        }
      }

      return { ledger_entry_ids: ledgerEntries };
    });
  }
}

export const ledgerService = new LedgerService();
