import { db } from "../../db";
import { deposits } from "@shared/deposits.schema";
import { wallets, ledger, users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { auditService } from "../../services/auditService";
import { notifyUser } from "../notifications/push.service";

// Q: هل جدول `deposits` يُنشأ تلقائياً عند بدء تشغيل السيرفر؟
// A: لا — جدول `deposits` مُعرَّف في ملف منفصل `shared/deposits.schema.ts` ولم
//    يُدرَج ضمن سكريبت التحقق التلقائي `server/autoVerifyDb.ts` الذي يُنشئ
//    الجداول عند الإقلاع. هذا يعني:
//    1. إذا استُدعيت دالة `depositService.approveDeposit` ستفشل بـ "relation does not exist".
//    2. نظام الإيداع الفعلي يعمل عبر جدول `wallet_transactions` في `walletService`، 
//       وهذا الـ `DepositService` هو كود ميت لا يُستدعى من أي مسار حالي.
//    الإصلاح المطلوب: إما دمج `deposits.schema.ts` في `schema.ts` الرئيسي وإضافة
//    الجدول لسكريبت التحقق، أو حذف هذا الـ service كلياً إذا لم يكن مطلوباً.
//    ⚠️ تحذير: استدعاء أي دالة هنا سيُسبب خطأ 500 في الإنتاج.
export class DepositService {
  async approveDeposit(depositId: string, adminId: string, force = false, notes?: string) {

    return await db.transaction(async (tx) => {
      // 1. Fetch and lock deposit
      const [deposit] = await tx
        .select()
        .from(deposits)
        .where(eq(deposits.id, depositId))
        .for("update");

      if (!deposit) throw new Error("DEPOSIT_NOT_FOUND");

      // 5️⃣ DEPOSIT DOUBLE APPROVAL PROTECTION
      if (!force && deposit.status === "APPROVED") {
        throw new Error("BUSINESS_RULE_VIOLATION: Deposit already approved");
      }

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

      // 6. Insert ledger entry (Order changed to ensure atomicity and guard)
      // 2️⃣ IDEMPOTENCY: Check if ledger entry already exists for this reference
      const [existingLedger] = await tx.select().from(ledger).where(and(eq(ledger.referenceId, depositId), eq(ledger.type, "DEPOSIT"))).for("update");
      if (existingLedger) {
         throw new Error("DUPLICATE_TRANSACTION: Deposit ledger entry already exists");
      }

      const [ledgerEntry] = await tx.insert(ledger).values({
        referenceId: depositId,
        creditUserId: deposit.customerId,
        amount: deposit.amount,
        type: "DEPOSIT",
      }).returning();

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

      // 8. Notify customer
      notifyUser(
        customer.id,
        "DEPOSIT_APPROVED",
        "تم قبول الإيداع",
        `تمت الموافقة على إيداعك بمبلغ ${deposit.amount} جنيه`,
        { depositId, amount: deposit.amount, newBalance }
      ).catch(console.error);

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
