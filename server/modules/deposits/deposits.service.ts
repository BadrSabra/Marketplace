import { db } from "../../db";
import { deposits } from "@shared/deposits.schema";
import { wallets, ledger, users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { auditService } from "../../services/auditService";
import { emitNotification } from "../notifications/notification.emitter";

export class DepositService {
  async approveDeposit(depositId: string, adminId: string, force = false, notes?: string) {
    console.log(`[AUDIT-DEPOSIT] deposit_id=${depositId} approved_by=${adminId} force=${force}`);

    return await db.transaction(async (tx) => {
      // 1. Fetch and lock deposit
      const [deposit] = await tx
        .select()
        .from(deposits)
        .where(eq(deposits.id, depositId))
        .for("update");

      if (!deposit) throw new Error("DEPOSIT_NOT_FOUND");

      // 2. Validate status
      if (!force && deposit.status !== "PENDING") {
        throw new Error("ALREADY_PROCESSED");
      }

      const amountNum = parseFloat(deposit.amount);

      // 3. Validate amount and customer
      if (!force && amountNum <= 0) {
        throw new Error("INVALID_AMOUNT");
      }

      const [customer] = await tx.select().from(users).where(eq(users.id, deposit.customerId));
      if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

      // 4. Update deposit status
      await tx.update(deposits)
        .set({
          status: "APPROVED",
          approvedBy: adminId,
          approvedAt: new Date(),
          notes: notes || deposit.notes,
          updatedAt: new Date()
        })
        .where(eq(deposits.id, depositId));

      // 5. Update wallet
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, deposit.customerId)).for("update");
      if (!wallet) throw new Error("WALLET_NOT_FOUND");

      const oldBalance = wallet.balance;
      const newBalance = (parseFloat(oldBalance) + amountNum).toFixed(2);

      await tx.update(wallets)
        .set({
          balance: newBalance,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // 6. Insert ledger entry
      const [ledgerEntry] = await tx.insert(ledger).values({
        referenceId: depositId,
        creditUserId: deposit.customerId,
        amount: deposit.amount,
        type: "DEPOSIT",
      }).returning();

      // 7. Audit log
      await auditService.logEvent({
        actionType: "DEPOSIT_APPROVED",
        entityType: "deposit",
        entityId: depositId,
        performedByUserId: adminId,
        performedByRole: "ADMIN",
        oldValue: { status: deposit.status, balance: oldBalance },
        newValue: { status: "APPROVED", balance: newBalance },
        metadata: { notes, force }
      });

      // 8. Emit Notification
      emitNotification("WALLET_UPDATE", customer.id, customer.role, {
        depositId,
        amount: deposit.amount,
        status: "APPROVED",
        newBalance
      });

      return {
        deposit_id: depositId,
        ledger_entry_id: ledgerEntry.id,
        status: "APPROVED" as const,
        message: "Deposit approved successfully"
      };
    });
  }
}

export const depositService = new DepositService();
