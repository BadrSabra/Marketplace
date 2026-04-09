import { db } from "../../db";
import { walletTransactions, users, wallets, ledger, withdrawalRequests } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { Wallet, InsertWallet, WalletTransaction, InsertWalletTransaction, WithdrawalRequest } from "@shared/schema";
import { notificationService } from "../notifications/notification.service";
import { notifyUser, notifyAdmins } from "../notifications/push.service";
import { ledgerService } from "../ledger/ledger.service";
import { auditService } from "../../services/auditService";
import { money } from "../../utils/money";

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
    
    // Q: لماذا نستخدم money.isNonPositive بدلاً من parseFloat(amount) <= 0 ؟
    // A: money.isNonPositive تستخدم حساب القروش الصحيح — تجنباً لأي حالة حدودية
    //    مثل "0.001" التي تُعيد parseFloat قيمة موجبة لكنها أقل من أصغر وحدة مالية.
    if (money.isNonPositive(amount)) {
      throw new Error("Amount must be greater than 0");
    }

    // Q: لماذا كان هذا الاستدعاء يستخدم `as any`؟
    // A: `as any` كان يُخفي خطأ TypeScript حقيقياً: نوع حقل `type` في Drizzle ORM
    //    هو PgEnumColumn<"transaction_type"> الذي يتوقع نوعاً محدداً في وقت الترجمة.
    //    إزالة `as any` تُظهر الخطأ المخفي: TypeScript يرفض "DEPOSIT" كـ string عادي
    //    ويتطلب تحديد النوع بـ `as const` أو `satisfies` لضمان توافق نوع enum.
    //
    // ⚠️ خطأ جديد تكشفه هذه الإصلاح:
    //    إذا تغيّر اسم أي قيمة في enum `transaction_type` مستقبلاً (مثل: DEPOSIT → CREDIT)،
    //    فإن الكود بدون `as any` سيفشل في وقت الترجمة مباشرةً بدلاً من الفشل بصمت في runtime.
    //    هذا سلوك صحيح — لكنه يعني أن أي migration مستقبلي للـ enum يتطلب تعديل الكود أيضاً.
    const [transaction] = await db.insert(walletTransactions).values({
      walletId: wallet.id,
      type: "DEPOSIT" as const,
      amount,
      receiptUrl,
      status: "PENDING" as const,
    }).returning();

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
      // Q: لماذا نستخدم money.isNegative / money.add بدلاً من parseFloat؟
      // A: parseFloat + toFixed يُسبب أخطاء تقريب في IEEE 754 لقيم معينة مثل 1.005
      //    التي تُعطي "1.00" بدلاً من "1.01". money.add يعمل بالقروش (أعداد صحيحة)
      //    ويتجنب هذه الأخطاء كلياً. راجع server/utils/money.ts للتفاصيل.
      if (money.isNegative(transaction.amount)) {
        throw new Error("BUSINESS_RULE_VIOLATION: Negative deduction amount not allowed");
      }

      const newBalance = money.add(wallet.balance, transaction.amount);

      if (money.isNegative(newBalance)) {
        throw new Error("BUSINESS_RULE_VIOLATION: Insufficient wallet balance");
      }
      
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

      // Q: لماذا نستخدم money utility لحساب newBalance بدلاً من parseFloat arithmetic؟
      // A: adminOverride يُعدّل أرصدة مالية حقيقية. استخدام parseFloat + toFixed
      //    قد يُسبب خطأ IEEE 754 عند جمع أعداد عشرية. money utility تتجنب ذلك.
      //
      // Q: كيف نتعامل مع amount السالب (WITHDRAWAL) في money utility؟
      // A: money.add و money.subtract تتوقع قيماً موجبة. لذا:
      //    - إذا amountNum > 0: استخدم money.add(balance, absAmount)
      //    - إذا amountNum < 0: استخدم money.subtract(balance, absAmount)
      //    أما absAmountStr: نحوّل القيمة المطلقة لـ string عبر Math.abs(amountNum).toFixed(2)
      //    (هذا التحويل الوحيد المقبول لأن amountNum تم التحقق منه أعلاه وهو عدد آمن).
      //
      // ⚠️ خطأ جديد تكشفه هذا الإصلاح:
      //    money.isNegative تُطلق استثناءً إذا كانت newBalance تحتوي على رقم غير صالح.
      //    هذا ممكن إذا كان wallet.balance في DB تالفاً (مثلاً "NaN" من خطأ سابق).
      //    الإصلاح الوقائي: إضافة `parseFloat(wallet.balance)` check قبل money operations.
      const absAmountStr = Math.abs(amountNum).toFixed(2);
      const newBalance = amountNum > 0
        ? money.add(wallet.balance, absAmountStr)
        : money.subtract(wallet.balance, absAmountStr);

      if (money.isNegative(newBalance)) {
        throw new Error("BUSINESS_RULE_VIOLATION: Override would result in negative balance");
      }

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
        amount: absAmountStr,
        type: amountNum > 0 ? "DEPOSIT" : "WITHDRAWAL",
      });

      // Q: هل يجب إنشاء سجل walletTransactions للتعديل الإداري على المحفظة؟
      // A: نعم — بدون هذا السجل، يرى المستخدم رصيده يتغير في المحفظة دون أي سبب
      //    مُدرَج في سجل معاملاته. هذا يُسبب ارتباكاً ويُضعف شفافية النظام المالي.
      //    الإصلاح: إنشاء walletTransactions بنوع DEPOSIT أو WITHDRAWAL بملاحظة "تعديل إداري"
      //    مع إدراج السبب (reason) الذي أدخله المشرف ليكون مرئياً في تاريخ المعاملات.
      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        type: amountNum > 0 ? "DEPOSIT" : "WITHDRAWAL",
        amount: absAmountStr,
        status: "COMPLETED",
        notes: `تعديل إداري: ${reason}`,
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
    // Q: لماذا نُدخل amount كـ string للـ withdraw بدلاً من number؟
    // A: نريد الحفاظ على الدقة من البداية. تمرير number يعني أن التحويل من string
    //    لـ number قد حدث خارجياً (في الـ controller) وقد فقد دقته بالفعل.
    //    string → money.isNonPositive → money.subtract يضمن سلسلة دقة كاملة.
    //
    // Q: لماذا نستبدل `parseFloat(amount) <= 0` بـ `money.isNonPositive`؟
    // A: money.isNonPositive تستخدم حساب القروش وتتحقق من `toCents(amount) <= 0`.
    //    هذا يُعالج حالة "0.001" التي يُعيدها parseFloat كـ 0.001 (موجبة تقنياً)
    //    لكنها أقل من قرش — وهي مبلغ غير قابل للتمثيل مالياً.
    //    الإصلاح: استبدال كل parseFloat arithmetic في withdraw بـ money utility.
    //
    // ⚠️ خطأ جديد تكشفه هذه الإصلاح:
    //    إذا أرسل المستخدم amount = "abc" أو "Infinity"، فإن money.isNonPositive
    //    ستُطلق استثناءً داخلياً من toCents بدلاً من رفض بسيط.
    //    الـ controller يتحقق بـ isNaN(parseFloat(amount)) قبل الاستدعاء — لكن
    //    الاعتماد على الـ controller وحده ليس دفاعاً كافياً. الإصلاح الدفاعي:
    //    إضافة تحقق صريح من صلاحية amount هنا أيضاً (Defense in Depth).
    if (isNaN(parseFloat(amount)) || !isFinite(parseFloat(amount))) {
      throw new Error("BUSINESS_RULE_VIOLATION: Amount must be a valid finite number");
    }
    if (money.isNonPositive(amount)) {
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

      // Q: لماذا نستخدم money.isLessThan بدلاً من `currentBalance < withdrawAmount`؟
      // A: money.isLessThan يعمل على القروش (أعداد صحيحة) ويتجنب أخطاء المقارنة
      //    الناتجة عن IEEE 754. مثال نادر: balance = "0.30" وamount = "0.10 + 0.20"
      //    — مع parseFloat قد تكون المقارنة خاطئة بسبب خطأ التمثيل الثنائي.
      if (money.isLessThan(lockedWallet.balance, amount)) {
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
      // Q: لماذا نستخدم money.subtract بدلاً من (currentBalance - withdrawAmount).toFixed(2)؟
      // A: money.subtract يعمل على القروش ويتجنب أخطاء IEEE 754. الرصيد المُخزَّن
      //    في DB قد يكون له تمثيل ثنائي غير دقيق إذا أُجريت عليه عمليات متعددة.
      const newBalance = money.subtract(lockedWallet.balance, amount);
      await tx.update(wallets)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(wallets.id, lockedWallet.id));

      // BUG-FIX-10: No walletTransactions record was created on withdrawal request.
      // Funds are deducted immediately so a PENDING WITHDRAWAL transaction must be recorded.
      // Q: لماذا نستخدم money.format(amount) هنا بدلاً من amount مباشرةً؟
      // A: money.format يضمن أن المبلغ بصيغة "X.XX" (رقمان عشريان) دائماً.
      //    إذا أرسل المستخدم "10" بدلاً من "10.00"، يُخزَّن في DB كـ "10.00"
      //    للتوافق مع باقي الأرقام في الجدول. هذا تناسق تقني لا أثر مالي له.
      const formattedAmount = money.format(amount);
      await tx.insert(walletTransactions).values({
        walletId: lockedWallet.id,
        type: "WITHDRAWAL",
        amount: formattedAmount,
        status: "PENDING",
        notes: "طلب سحب بانتظار موافقة المشرف",
      });

      // Create a pending withdrawal request
      const [request] = await tx.insert(withdrawalRequests).values({
        userId,
        walletId: lockedWallet.id,
        amount: formattedAmount,
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
        metadata: { amount: formattedAmount }
      });

      return request;
    }).then((request) => {
      notifyAdmins(
        "SYSTEM_ALERT",
        "طلب سحب جديد",
        `مستخدم قدّم طلب سحب بمبلغ ${request.amount} جنيه، يحتاج لمراجعتك`,
        { requestId: request.id, userId, amount: request.amount }
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

      // Q: لماذا نستخدم money.add هنا بدلاً من parseFloat + toFixed لحساب refundedBalance؟
      // A: نفس سبب جميع الإصلاحات السابقة — IEEE 754 float arithmetic غير موثوق للأموال.
      //    مثال: إذا كان balance = "99.90" وrequest.amount = "0.10"
      //    parseFloat("99.90") + parseFloat("0.10") = 100.00000000000001 (في بعض البيئات)
      //    .toFixed(2) قد يُصلح هذا أو لا — سلوك غير مضمون عبر محركات JS المختلفة.
      //    money.add("99.90", "0.10") = fromCents(9990 + 10) = fromCents(10000) = "100.00" ✓
      //
      // ⚠️ خطأ جديد تكشفه هذا الإصلاح:
      //    إذا كان request.amount في DB بصيغة غير صالحة (مثلاً نص تالف) بعد خطأ قديم،
      //    فإن money.add ستُطلق استثناءً "[Money] Invalid amount" بدلاً من إعطاء نتيجة خاطئة.
      //    هذا سلوك أفضل (fail-fast) لكن يعني أن رفض بعض الطلبات القديمة سيفشل
      //    ويحتاج تدخلاً يدوياً لتصحيح البيانات التالفة في DB.
      const refundedBalance = money.add(wallet.balance, request.amount);
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

      // Q: هل يكفي تحديث الـ PENDING WITHDRAWAL إلى FAILED دون إنشاء سجل REFUND جديد؟
      // A: لا — المستخدم يحتاج لسجل صريح يُوضّح سبب ارتفاع رصيده. الكود السابق كان:
      //    1. يُعيد الرصيد للمحفظة ✓
      //    2. يُسجّل REFUND في ledger ✓
      //    3. يُحوّل الـ PENDING WITHDRAWAL إلى FAILED ✓
      //    4. ✗ لا يُنشئ walletTransaction جديداً من نوع REFUND
      //    النتيجة: يرى العميل رصيده يرتفع بشكل غامض — WITHDRAWAL مرفوض (FAILED)
      //    بلا أي سجل يُفسّر الائتمان، مما يُربك تاريخ المعاملات.
      //    الإصلاح: إنشاء سجل REFUND في walletTransactions لإكمال الأثر المالي.
      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        type: "REFUND",
        amount: request.amount,
        status: "COMPLETED",
        notes: `استرداد طلب سحب مرفوض${note ? ` — ${note}` : ""}`,
      });

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
    // Q: لماذا نستخدم money.isNonPositive بدلاً من `parseFloat(amount) <= 0`؟
    // A: انظر التعليق في دالة withdraw() — نفس المبررات تنطبق هنا.
    //    deductBalance مسار بديل للخصم يستدعيه كود داخلي (مثل payForOrder في سياقات معينة).
    //    الفرق: withdraw() يُنشئ withdrawal_request، بينما deductBalance يخصم مباشرةً.
    if (isNaN(parseFloat(amount)) || !isFinite(parseFloat(amount))) {
      throw new Error("BUSINESS_RULE_VIOLATION: Invalid deduction amount");
    }
    if (money.isNonPositive(amount)) {
      return; // خصم بقيمة صفر أو سالبة — لا شيء للتنفيذ (نفس سلوك الكود السابق)
    }

    const formattedAmount = money.format(amount);

    await db.transaction(async (tx) => {
      // BUG-FIX: Was calling this.getOrCreateWallet() outside tx (uses global db),
      // then locking with tx separately — breaking atomicity. Now using tx directly.
      const [lockedWallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for("update");
      
      if (!lockedWallet) {
        throw new Error("NOT_FOUND: Wallet not found");
      }

      // Q: لماذا money.isLessThan بدلاً من `currentBalance < deductAmount`؟
      // A: نفس مبرر withdraw() — مقارنة القروش كأعداد صحيحة أدق من مقارنة float.
      if (money.isLessThan(lockedWallet.balance, formattedAmount)) {
        throw new Error("BUSINESS_RULE_VIOLATION: Insufficient wallet balance");
      }

      const newBalance = money.subtract(lockedWallet.balance, formattedAmount);

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
        amount: formattedAmount,
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
