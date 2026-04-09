import { db } from "../db";
import { wallets, ledger, auditLogs, walletTransactions } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// Q: هل يُستخدم walletTransactionWrapper فعلاً في أي مكان بالكود؟
// A: لا — هذه الدالة كود ميت (dead code) لم تُستورَد أو تُستدعَ من أي ملف آخر
//    في المشروع بأكمله. جميع العمليات المالية الحقيقية تمر عبر:
//    - walletService.adminOverride  → تعديلات المشرف
//    - walletService.requestWithdrawal / approveWithdrawal → طلبات السحب
//    - deliveryOfferService.customerAcceptOffer → دفع رسوم التوصيل
//    - ledgerService.processCommissions → توزيع العمولات
//    
//    تحذير من عيوب التصميم لو استُخدمت مستقبلاً:
//    1. referenceId: result.id يفترض أن كل نتيجة من operation تحتوي .id — لو
//       operation أعادت مصفوفة أو كائناً بدون id، يُسجَّل referenceId: undefined
//       في الـ ledger وهو خطأ صامت لا يُكتشف حتى مراجعة البيانات.
//    2. COMMISSION type: كلا creditUserId وdebitUserId يُضبَطان على null (الشرط
//       الأول يعطي credit فقط لـ DEPOSIT، والثاني debit فقط لـ WITHDRAWAL).
//       سجل لدجر برقمين null يعني أن المنصة "تستلم" مالاً دون أن يتضح مصدره —
//       معادلة محاسبية ناقصة وبيانات فاسدة لتقارير المالية.
//    3. الدالة تُنشئ سجل ledger لكنها لا تُحدّث رصيد المحفظة wallet.balance —
//       مما يُفقد التزامن بين الأرقام الدفترية والرصيد الفعلي للمستخدم.
//    الإصلاح: إذا احتُيج لاستخدام هذه الدالة مستقبلاً، يجب حذفها وإعادة بنائها
//    على غرار walletService التي تُحدّث المحفظة والدفتر والمعاملات معاً.

// BUG-FIX: Added "REFUND" to the type union to match the updated ledger schema
export async function walletTransactionWrapper(
  userId: string,
  amount: string,
  type: "DEPOSIT" | "WITHDRAWAL" | "COMMISSION" | "REFUND",
  operation: (tx: any) => Promise<any>
) {
  try {
    return await db.transaction(async (tx: any) => {
      const result = await operation(tx);
      
      // Atomic ledger entry
      await tx.insert(ledger).values({
        creditUserId: type === "DEPOSIT" ? userId : null,
        debitUserId: type === "WITHDRAWAL" ? userId : null,
        amount,
        type,
        referenceId: result.id
      });

      return result;
    });
  } catch (error: any) {
    console.error(JSON.stringify({ level: "error", message: "Transaction failed", error: error.message, userId }));
    
    // Log failure to audit logs
    await db.insert(auditLogs).values({
      actionType: "TRANSACTION_FAILURE",
      entityType: "WALLET",
      entityId: userId,
      performedByUserId: userId,
      performedByRole: "SYSTEM",
      newValue: { error: error.message, amount, type }
    });
    
    throw error;
  }
}
