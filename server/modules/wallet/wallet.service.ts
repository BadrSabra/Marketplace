import { db } from "../../db";
import { walletTransactions, users, wallets, ledger, withdrawalRequests } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { Wallet, InsertWallet, WalletTransaction, InsertWalletTransaction, WithdrawalRequest } from "@shared/schema";
import { notificationService } from "../notifications/notification.service";
import { notifyUser, notifyAdmins } from "../notifications/push.service";
import { ledgerService } from "../ledger/ledger.service";
import { auditService } from "../../services/auditService";

export class WalletService {
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    // BUG-FIX: The previous SELECT + INSERT pattern had a TOCTOU race condition.
    // Two concurrent calls for the same userId could both see no row and both INSERT,
    // creating duplicate wallets (no UNIQUE constraint existed on user_id before this fix).
    // Now: attempt INSERT with ON CONFLICT DO NOTHING, then re-SELECT if nothing was inserted.
    // This is fully atomic and safe under any concurrency.
    const inserted = await db.insert(wallets)
      .values({ userId, balance: "0.00" })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) return inserted[0];

    const [existing] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    return existing;
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

    notifyAdmins(
      "SYSTEM_ALERT",
      "طلب إيداع جديد",
      `مستخدم قدّم طلب إيداع بمبلغ ${amount} جنيه، يحتاج لمراجعتك`,
      { transactionId: transaction.id, userId, amount }
    ).catch(console.error);

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

  async approveDeposit(transactionId: string, adminId?: string): Promise<WalletTransaction> {
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

      // BUG-FIX-7: Missing ledger entry for approved deposit — broke double-entry accounting.
      // A deposit credits the customer wallet and must be recorded in the ledger.
      await tx.insert(ledger).values({
        referenceId: transactionId,
        debitUserId: null,
        creditUserId: wallet.userId,
        amount: transaction.amount,
        type: "DEPOSIT",
      });

      // BUG-FIX: Was using user?.id (the CUSTOMER) as performedByUserId because approveDeposit()
      // had no adminId parameter. The admin who approved the deposit was never recorded in the
      // audit trail — every deposit approval appeared as if the customer approved their own deposit.
      // Now accepts an optional adminId and prefers it over the customer's ID in the audit entry.
      await auditService.logEvent({
        actionType: "DEPOSIT_APPROVED",
        entityType: "wallet_transaction",
        entityId: transactionId,
        performedByUserId: adminId || user?.id || wallet.userId,
        performedByRole: adminId ? "ADMIN" : (user?.role || "ADMIN"),
        oldValue: { balance: wallet.balance },
        newValue: { balance: newBalance },
        metadata: { amount: transaction.amount, walletId: wallet.id, customerId: wallet.userId }
      });

      if (user) {
        await notificationService.notifyDepositApproved(user.email, transaction.amount);
      }

      return updatedTransaction;
    });
  }

  async adminOverride(walletId: string, amount: string, reason: string, actorId: string): Promise<string> {
    // Q: هل يجب التحقق من NaN في adminOverride على مستوى الـ service؟
    // A: من الناحية المثالية نعم، لكن الـ controller (wallet.controller.ts) يتحقق بالفعل
    //    من `isNaN(parseFloat(amount))` قبل استدعاء هذه الدالة. الطبقة المزدوجة
    //    (Controller + Service) هي مبدأ Defense in Depth لكنها ليست حرجة هنا لأن
    //    المسار الوحيد لـ adminOverride يمر عبر walletController.adminOverride.
    //    ملاحظة: إذا استُدعيت هذه الدالة مستقبلاً من كود آخر بدون المرور بالـ controller،
    //    فإن `parseFloat(NaN)` سيكون NaN و `NaN < 0` = false و `NaN === 0` = false
    //    مما سيُسبب تخزين "NaN" كرصيد — بيانات تالفة في الـ DB.
    //    الإصلاح الدفاعي الموصى به: إضافة `if (isNaN(amountNum)) throw` هنا.
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) {
      throw new Error("BAD_REQUEST: Amount must be a valid number");
    }
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

      // BUG-FIX-13: Removed unnecessary information_schema table-existence checks.
      // These tables are guaranteed to exist (auto-created on startup).
      // The try/catch was silently swallowing real errors, hiding actual failures.
      await tx.insert(ledger).values({
        referenceId: null,
        creditUserId: amountNum > 0 ? wallet.userId : null,
        debitUserId: amountNum < 0 ? wallet.userId : null,
        amount: Math.abs(amountNum).toFixed(2),
        type: amountNum > 0 ? "DEPOSIT" : "WITHDRAWAL",
      });

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

      return newBalance;
    });
  }

  async withdraw(userId: string, amount: string): Promise<WithdrawalRequest> {
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      throw new Error("BUSINESS_RULE_VIOLATION: Amount must be a positive number");
    }

    return await db.transaction(async (tx) => {
      // BUG-FIX-9: Was calling this.getOrCreateWallet() which uses the global `db`,
      // not the transaction `tx`. Wallet creation would NOT roll back if the tx failed.
      // Now locked wallet lookup is done directly inside the transaction.
      const [lockedWallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for("update");
      if (!lockedWallet) throw new Error("NOT_FOUND: Wallet not found");

      // BUG-FIX-8: Was hardcoding performedByRole: "DRIVER" even though STORE_OWNER
      // can also withdraw. Fetch the actual user role from DB.
      const [actorUser] = await tx.select({ role: users.role }).from(users).where(eq(users.id, userId));
      const actorRole = actorUser?.role ?? "DRIVER";

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

      // BUG-FIX-10: No walletTransactions record was created on withdrawal request.
      // Funds are deducted immediately so a PENDING WITHDRAWAL transaction must be recorded.
      await tx.insert(walletTransactions).values({
        walletId: lockedWallet.id,
        type: "WITHDRAWAL",
        amount: withdrawAmount.toFixed(2),
        status: "PENDING",
        notes: "طلب سحب بانتظار موافقة المشرف",
      });

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
        performedByRole: actorRole,
        oldValue: { balance: lockedWallet.balance },
        newValue: { balance: newBalance },
        metadata: { amount }
      });

      return request;
    }).then((request) => {
      notifyAdmins(
        "SYSTEM_ALERT",
        "طلب سحب جديد",
        `مستخدم قدّم طلب سحب بمبلغ ${withdrawAmount.toFixed(2)} جنيه، يحتاج لمراجعتك`,
        { requestId: request.id, userId, amount: withdrawAmount.toFixed(2) }
      ).catch(console.error);
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
    // Capture email + amount for post-transaction notification (email is non-critical,
    // must not be sent inside the transaction where a failure would prevent the commit).
    let notifData: { email: string; amount: string } | null = null;

    const result = await db.transaction(async (tx) => {
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

      // BUG-FIX: The wallet transaction created as PENDING on withdrawal request was never
      // updated to COMPLETED on approval. Funds were deducted but the transaction stayed PENDING
      // forever, causing ledger.service.ts heldFunds calculation to permanently count approved
      // withdrawals as "held" and inflating reported held funds.
      // BUG-FIX-2: Previous update was too broad — matched ALL PENDING WITHDRAWAL transactions
      // for the wallet instead of only the one linked to this request. If a user had multiple
      // PENDING withdrawal transactions (edge case), all would be marked COMPLETED.
      // Now fetches the specific matching transaction by walletId + type + status + amount first,
      // then updates by ID for a precise single-row update.
      const [pendingWalletTx] = await tx
        .select({ id: walletTransactions.id })
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.walletId, request.walletId),
          eq(walletTransactions.type, "WITHDRAWAL"),
          eq(walletTransactions.status, "PENDING"),
          eq(walletTransactions.amount, request.amount)
        ))
        .limit(1);

      if (pendingWalletTx) {
        await tx.update(walletTransactions)
          .set({ status: "COMPLETED" })
          .where(eq(walletTransactions.id, pendingWalletTx.id));
      }

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

      // Push notification (fire-and-forget)
      notifyUser(
        request.userId,
        "WITHDRAWAL_APPROVED",
        "تم قبول طلب السحب",
        `تمت الموافقة على سحب ${request.amount} جنيه من محفظتك`,
        { amount: request.amount }
      ).catch(console.error);

      // Fetch user email for post-transaction email notification
      const [user] = await tx.select({ email: users.email }).from(users).where(eq(users.id, request.userId)).limit(1);
      if (user) notifData = { email: user.email, amount: request.amount };

      return updatedRequest;
    });

    // Send email AFTER the transaction commits so a nodemailer failure cannot roll back
    // the withdrawal approval. Email delivery is best-effort and non-blocking.
    if (notifData) {
      const { email, amount } = notifData as { email: string; amount: string };
      notificationService.notifyWithdrawalApproved(email, amount).catch(console.error);
    }

    return result;
  }

  async rejectWithdrawal(requestId: string, adminId: string, note?: string): Promise<WithdrawalRequest> {
    let notifData: { email: string; amount: string } | null = null;

    const result = await db.transaction(async (tx) => {
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

      // BUG-FIX: Was silently skipping the balance refund AND the ledger reversal if the
      // wallet row was somehow missing. The withdrawal already deducted the balance at
      // request-time, so a missing wallet here means the user's money simply vanishes.
      // Throwing ensures the transaction rolls back rather than committing a one-sided debit.
      if (!wallet) throw new Error("WALLET_NOT_FOUND: Cannot refund withdrawal — wallet missing");

      const refundedBalance = (parseFloat(wallet.balance) + parseFloat(request.amount)).toFixed(2);
      await tx.update(wallets)
        .set({ balance: refundedBalance, updatedAt: new Date() })
        .where(eq(wallets.id, wallet.id));

      // Credit the user back in the ledger (reversal of the original debit on request creation)
      // BUG-FIX: Was type "DEPOSIT" which conflates a withdrawal rejection reversal with a
      // new deposit. Now uses "REFUND" for accurate audit trail and financial reporting.
      await tx.insert(ledger).values({
        referenceId: request.id,
        debitUserId: null,
        creditUserId: request.userId,
        amount: request.amount,
        type: "REFUND",
      });

      // BUG-FIX: The wallet transaction created as PENDING on withdrawal request was never
      // updated to FAILED on rejection. It stayed PENDING forever, causing the heldFunds
      // calculation to permanently show rejected withdrawals as "held" and the wallet
      // transaction history to show a ghost PENDING withdrawal indefinitely.
      // BUG-FIX-2: Same over-broad issue as in approveWithdrawal — now fetches the specific
      // matching transaction by ID before updating, rather than updating all matching rows.
      const [pendingWalletTxToFail] = await tx
        .select({ id: walletTransactions.id })
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.walletId, request.walletId),
          eq(walletTransactions.type, "WITHDRAWAL"),
          eq(walletTransactions.status, "PENDING"),
          eq(walletTransactions.amount, request.amount)
        ))
        .limit(1);

      if (pendingWalletTxToFail) {
        await tx.update(walletTransactions)
          .set({ status: "FAILED" })
          .where(eq(walletTransactions.id, pendingWalletTxToFail.id));
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

      // Push notification (fire-and-forget)
      notifyUser(
        request.userId,
        "WITHDRAWAL_REJECTED",
        "تم رفض طلب السحب",
        `تم رفض طلب سحب ${request.amount} جنيه وتم إعادة المبلغ لمحفظتك`,
        { amount: request.amount, note }
      ).catch(console.error);

      // Fetch user email for post-transaction email notification
      const [user] = await tx.select({ email: users.email }).from(users).where(eq(users.id, request.userId)).limit(1);
      if (user) notifData = { email: user.email, amount: request.amount };

      return updatedRequest;
    });

    // Send email AFTER the transaction commits so a nodemailer failure cannot roll back
    // the withdrawal rejection. Email delivery is best-effort and non-blocking.
    if (notifData) {
      const { email, amount } = notifData as { email: string; amount: string };
      notificationService.notifyWithdrawalRejected(email, amount).catch(console.error);
    }

    return result;
  }

  async deductBalance(userId: string, amount: string, referenceId?: string): Promise<void> {
    const deductAmount = parseFloat(amount);
    if (deductAmount < 0) {
      throw new Error("BUSINESS_RULE_VIOLATION: Negative deduction amount not allowed");
    }
    if (deductAmount === 0) return;

    await db.transaction(async (tx) => {
      // BUG-FIX: Was calling this.getOrCreateWallet() outside tx (uses global db),
      // then locking with tx separately — breaking atomicity. Now using tx directly.
      const [lockedWallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for("update");
      
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

      // Q: هل يجب تسجيل سجل walletTransactions عند استدعاء deductBalance؟
      // A: نعم بالتأكيد — كل خصم من المحفظة يجب أن يُترك أثراً في جدول walletTransactions
      //    لضمان اكتمال سجل المعاملات المرئي للمستخدم. الغياب الحالي يعني أن أي مستدعٍ
      //    مستقبلي لـ deductBalance لن يجد الخصم في تاريخ المعاملات — المال يختفي بصمت.
      //    الإصلاح: إضافة سجل WITHDRAWAL بحالة COMPLETED لكل خصم عبر هذه الدالة.
      await tx.insert(walletTransactions).values({
        walletId: lockedWallet.id,
        type: "WITHDRAWAL",
        amount: deductAmount.toFixed(2),
        relatedOrderId: referenceId ?? null,
        status: "COMPLETED",
        notes: "خصم نظام داخلي",
      });

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
