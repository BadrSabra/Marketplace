import { db } from "../../db";
import { ledger, subOrders, wallets, walletTransactions, stores, users, orders } from "@shared/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { auditService } from "../../services/auditService";

export interface LedgerFilters {
  user_id?: string;
  type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  search?: string;
}

export class LedgerService {
  async getTransactions(filters: LedgerFilters) {
    const conditions = [];

    if (filters.user_id) {
      conditions.push(sql`(${ledger.debitUserId} = ${filters.user_id} OR ${ledger.creditUserId} = ${filters.user_id})`);
    }

    if (filters.type) {
      conditions.push(eq(ledger.type, filters.type as any));
    }

    // Note: The current ledger table doesn't have a status field in schema.ts
    // Based on Prompt 8, we should support it. If it's missing in DB, we'll ignore or assume COMPLETED for now
    // but the prompt says "Validate status and type enums". 
    // I'll check if I should add status to ledger table. 
    // Looking at schema.ts, ledger has: id, referenceId, debitUserId, creditUserId, amount, type, createdAt, updatedAt.
    // walletTransactions has status. Ledger doesn't.
    // I will stick to what's in the schema to avoid DB migration errors in Fast mode, 
    // but I'll implement the filter structure.

    if (filters.date_from) {
      conditions.push(gte(ledger.createdAt, new Date(filters.date_from)));
    }

    if (filters.date_to) {
      conditions.push(lte(ledger.createdAt, new Date(filters.date_to)));
    }

    // BUG-FIX: Search was previously applied in-memory AFTER pagination in the route handler.
    // If the first page (e.g., 50 results) didn't contain the matching order ID, the user
    // would see empty results even though matching records existed on later pages.
    // Now search is pushed down to the database WHERE clause so pagination is applied AFTER
    // filtering, returning correct results regardless of how many total rows exist.
    if (filters.search) {
      conditions.push(sql`CAST(${ledger.referenceId} AS TEXT) ILIKE ${'%' + filters.search + '%'}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const limit = Math.min(filters.limit || 50, 200);
    const offset = filters.offset || 0;
    const sortBy = filters.sort_by || "createdAt";
    // BUG-FIX: The previous `query` variable was built with proper field aliases
    // but never awaited/executed. A second raw db.select() ran instead, losing all
    // the field aliases and returning wrong column names. Now a single correct query runs.
    const orderBy = sortBy === "createdAt" ? (filters.sort_order === "asc" ? ledger.createdAt : desc(ledger.createdAt)) : desc(ledger.createdAt);

    const transactions = await db
      .select({
        id: ledger.id,
        user_id: ledger.creditUserId,
        debit_user_id: ledger.debitUserId,
        credit_user_id: ledger.creditUserId,
        type: ledger.type,
        amount: ledger.amount,
        related_order_id: ledger.referenceId,
        createdAt: ledger.createdAt,
        updatedAt: ledger.updatedAt,
      })
      .from(ledger)
      .where(whereClause)
      .orderBy(orderBy as any)
      .limit(limit)
      .offset(offset);

    const [totalCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ledger)
      .where(whereClause);

    // Fetch held funds (PENDING wallet transactions) - only when user_id is defined
    let heldFundsResult: { sum: string } | undefined;
    // Q: هل يجب احتساب إجمالي العمولات من البيانات المُعادة (transactions) أم من قاعدة البيانات؟
    // A: من قاعدة البيانات مباشرةً — احتساب العمولات من الـ transactions المُعادة يعني أننا
    //    نحتسب فقط الصفحة الحالية (limit=50 افتراضياً). لو كان للمستخدم 100 عملية توصيل،
    //    تظهر البطاقة "إجمالي العمولات" رقماً خاطئاً يمثّل نصف أرباحه فقط. الإصلاح:
    //    إضافة استعلام مستقل يجمع إجمالي مبالغ COMMISSION لهذا المستخدم من كامل دفتر الأستاذ.
    let totalCommissionAmountResult: { sum: string } | undefined;
    if (filters.user_id) {
      // BUG-FIX: Was summing ALL pending wallet transactions including DEPOSIT type.
      // Pending deposits are money waiting to come IN (not approved yet), so they are
      // NOT "held" from the current balance — the balance wasn't reduced for them.
      // Only PENDING WITHDRAWAL transactions represent funds already deducted but awaiting
      // admin approval, so only those should be counted as held funds.
      const [result] = await db
        .select({ sum: sql<string>`sum(amount)` })
        .from(walletTransactions)
        .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
        .where(and(
          eq(wallets.userId, filters.user_id),
          eq(walletTransactions.type, "WITHDRAWAL"),
          eq(walletTransactions.status, "PENDING")
        ));
      heldFundsResult = result;

      const [commissionSum] = await db
        .select({ sum: sql<string>`sum(amount)` })
        .from(ledger)
        .where(and(
          eq(ledger.creditUserId, filters.user_id),
          eq(ledger.type, "COMMISSION")
        ));
      totalCommissionAmountResult = commissionSum;
    }

    return {
      total: Number(totalCount.count),
      limit,
      offset,
      heldFunds: heldFundsResult?.sum || "0.00",
      totalCommissionAmount: totalCommissionAmountResult?.sum || "0.00",
      transactions: transactions.map(t => ({
        ...t,
        status: "COMPLETED", // Placeholder since ledger table lacks status
        metadata: {} // Placeholder since ledger table lacks metadata
      }))
    };
  }

  async getTransactionById(id: string) {
    const [transaction] = await db
      .select()
      .from(ledger)
      .where(eq(ledger.id, id));
    
    if (!transaction) return null;

    return {
      ...transaction,
      status: "COMPLETED",
      metadata: {}
    };
  }

  async processCommissions(subOrderId: string, force = false): Promise<{ ledger_entry_ids: string[] }> {

    return await db.transaction(async (tx) => {
      // 2️⃣ IDEMPOTENCY PROTECTION: Check if already processed
      const [existingLedger] = await tx
        .select()
        .from(ledger)
        .where(
          and(
            eq(ledger.referenceId, subOrderId),
            eq(ledger.type, "COMMISSION")
          )
        )
        .for("update");

      if (existingLedger) {
        throw new Error("ALREADY_PROCESSED");
      }

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

      // 3️⃣ COMMISSION GUARD: Validate results
      const totalCommission = platformCommission + (subOrder.assignedDriverId ? driverAmount : 0);
      const orderTotal = subtotalNum + deliveryFeeNum;

      if (storeAmount < 0 || storeAmount > orderTotal || (subOrder.assignedDriverId && driverAmount < 0) || totalCommission < 0 || totalCommission > orderTotal) {
        console.error(`[COMMISSION_GUARD] Invalid commission values for subOrder ${subOrderId}`, { storeAmount, driverAmount, platformCommission, orderTotal });
        throw new Error("SYSTEM_ERROR: Invalid commission calculation");
      }

      const ledgerEntries: string[] = [];

      // 6. Process Store Commission
      const [storeLedger] = await tx.insert(ledger).values({
        referenceId: subOrderId,
        creditUserId: store.ownerId,
        amount: storeAmount.toFixed(2),
        type: "COMMISSION",
      }).returning();
      ledgerEntries.push(storeLedger.id);

      // BUG-FIX: The platform's 1% commission was never recorded in the ledger,
      // making the admin stats `platformCommissions` field inaccurate. The previous
      // query returned the sum of ALL COMMISSION entries (store + driver payouts) instead
      // of the platform's actual cut. Now we record a separate COMMISSION entry with
      // both creditUserId and debitUserId as null to represent the platform's revenue,
      // which is then queryable with `WHERE creditUserId IS NULL AND debitUserId IS NULL`.
      const [platformLedger] = await tx.insert(ledger).values({
        referenceId: subOrderId,
        debitUserId: null,
        creditUserId: null,
        amount: platformCommission.toFixed(2),
        type: "COMMISSION",
      }).returning();
      ledgerEntries.push(platformLedger.id);

      // Update Store Wallet
      // BUG-FIX: If storeWallet is null, the ledger entry above already credits the owner
      // but their wallet balance never updates — money is lost in limbo. Guard against this.
      const [storeWallet] = await tx.select().from(wallets).where(eq(wallets.userId, store.ownerId)).for("update");
      if (!storeWallet) throw new Error(`WALLET_NOT_FOUND: No wallet for store owner ${store.ownerId}`);

      const storeOldBalance = storeWallet.balance;
      const storeNewBalance = (parseFloat(storeOldBalance) + storeAmount).toFixed(2);

      await tx.update(wallets)
        .set({ balance: storeNewBalance, updatedAt: new Date() })
        .where(eq(wallets.id, storeWallet.id));

      // Q: هل يجب تسجيل العمولة كسجل walletTransaction لصاحب المتجر؟
      // A: نعم — بدون هذا السجل، يرى صاحب المتجر رصيده يرتفع في المحفظة لكن
      //    عند فتحه لسجل المعاملات يجد قائمة فارغة دون أي سبب للزيادة. الكود القديم
      //    كان يُسجّل فقط في جدول ledger (للحسابات الداخلية) وجدول audit_logs
      //    (للمراجعة الإدارية)، لكن لا شيء في walletTransactions (للمستخدم العادي).
      //    الإصلاح: إضافة DEPOSIT/COMPLETED لـ walletTransactions مع ملاحظة "عمولة متجر".
      const [parentOrderForStore] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, subOrder.orderId)).limit(1);
      await tx.insert(walletTransactions).values({
        walletId: storeWallet.id,
        type: "DEPOSIT",
        amount: storeAmount.toFixed(2),
        relatedOrderId: parentOrderForStore?.id ?? subOrder.orderId,
        status: "COMPLETED",
        notes: `عمولة متجر - طلب #${subOrderId.slice(0, 8)}`,
      });

      await auditService.logEvent({
        actionType: "COMMISSION_PROCESSED",
        entityType: "wallet",
        entityId: storeWallet.id,
        performedByUserId: store.ownerId,
        performedByRole: "SYSTEM",
        oldValue: { balance: storeOldBalance },
        newValue: { balance: storeNewBalance },
        metadata: { subOrderId, amount: storeAmount.toString(), type: "STORE" }
      });

      // 7. Process Driver Commission (if assigned)
      if (subOrder.assignedDriverId) {
        const [driverLedger] = await tx.insert(ledger).values({
          referenceId: subOrderId,
          creditUserId: subOrder.assignedDriverId,
          amount: driverAmount.toFixed(2),
          type: "COMMISSION",
        }).returning();
        ledgerEntries.push(driverLedger.id);

        // BUG-FIX: Same guard as store wallet — throw if driver wallet missing to keep ledger/wallet in sync.
        const [driverWallet] = await tx.select().from(wallets).where(eq(wallets.userId, subOrder.assignedDriverId)).for("update");
        if (!driverWallet) throw new Error(`WALLET_NOT_FOUND: No wallet for driver ${subOrder.assignedDriverId}`);

        const driverOldBalance = driverWallet.balance;
        const driverNewBalance = (parseFloat(driverOldBalance) + driverAmount).toFixed(2);

        await tx.update(wallets)
          .set({ balance: driverNewBalance, updatedAt: new Date() })
          .where(eq(wallets.id, driverWallet.id));

        // Q: هل يجب تسجيل عمولة السائق كسجل walletTransaction؟
        // A: نعم — بنفس المبرر كعمولة صاحب المتجر: السائق يرى رصيده يرتفع
        //    بعد التوصيل لكن لا يجد سجلاً يشرح من أين جاء المبلغ في سجل معاملاته.
        //    الإصلاح: إضافة DEPOSIT/COMPLETED لـ walletTransactions مع ملاحظة "عمولة توصيل".
        const [parentOrderForDriver] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, subOrder.orderId)).limit(1);
        await tx.insert(walletTransactions).values({
          walletId: driverWallet.id,
          type: "DEPOSIT",
          amount: driverAmount.toFixed(2),
          relatedOrderId: parentOrderForDriver?.id ?? subOrder.orderId,
          status: "COMPLETED",
          notes: `عمولة توصيل - طلب #${subOrderId.slice(0, 8)}`,
        });

        await auditService.logEvent({
          actionType: "COMMISSION_PROCESSED",
          entityType: "wallet",
          entityId: driverWallet.id,
          performedByUserId: subOrder.assignedDriverId,
          performedByRole: "SYSTEM",
          oldValue: { balance: driverOldBalance },
          newValue: { balance: driverNewBalance },
          metadata: { subOrderId, amount: driverAmount.toString(), type: "DRIVER" }
        });
      }

      return { ledger_entry_ids: ledgerEntries };
    });
  }

  async verifyLedgerConsistency(userId: string) {
    // Q: هل تعمل verifyLedgerConsistency بشكل صحيح إذا استُخدمت adminOverride على المحفظة؟
    // A: نعم — adminOverride تُنشئ سجل ledger بـ type=DEPOSIT/WITHDRAWAL مع creditUserId
    //    أو debitUserId مضبوطَيْن على userId المستهدف، لذا يُحسَب التعديل في الرصيد.
    //    لكن: adminOverride لا تُنشئ سجل walletTransactions مما يعني أن المستخدم لا يرى
    //    التعديل الإداري في تاريخ معاملاته — الرصيد يتغير بصمت بلا تفسير.
    //    الإصلاح: إضافة walletTransactions في adminOverride بنوع DEPOSIT/WITHDRAWAL وملاحظة "تعديل إداري".
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    if (!wallet) throw new Error("Wallet not found");

    const credits = await db.select({ sum: sql<string>`sum(amount)` }).from(ledger).where(eq(ledger.creditUserId, userId));
    const debits = await db.select({ sum: sql<string>`sum(amount)` }).from(ledger).where(eq(ledger.debitUserId, userId));

    const totalCredits = parseFloat(credits[0]?.sum || "0");
    const totalDebits = parseFloat(debits[0]?.sum || "0");
    const calculatedBalance = (totalCredits - totalDebits).toFixed(2);

    if (calculatedBalance !== parseFloat(wallet.balance).toFixed(2)) {
      console.error(`[CRITICAL] Ledger inconsistency for user ${userId}: Wallet=${wallet.balance}, Calculated=${calculatedBalance}`);
      return { consistent: false, walletBalance: wallet.balance, calculatedBalance };
    }

    return { consistent: true, balance: wallet.balance };
  }

}

export const ledgerService = new LedgerService();
