import { db } from "../../db";
import { deliveryOtps, subOrders, orders } from "@shared/schema";
import { eq, and, lt, gt } from "drizzle-orm";
import { ledgerService } from "../ledger/ledger.service";
import crypto from "crypto";

export class DeliveryOtpService {
  // Q: لماذا أصبحت generateOtp idempotent (تُعيد OTP موجودة إذا كانت صالحة)؟
  // A: الكود القديم كان يُولّد OTP جديدة دائماً ويُبطل القديمة. هذا يخلق race condition:
  //    طلبان متزامنان على نفس sub-order (مثلاً طلبان متزامنان لـ GET /api/orders/my-orders)
  //    كلاهما يجد OTP منتهية الصلاحية فيُطلقان generateOtp معاً:
  //    - الأول يُولّد OTP#1 ويُبطل القديمة
  //    - الثاني يُبطل OTP#1 ويُولّد OTP#2
  //    العميل يرى OTP#1 في شاشته لكن DB تحتوي على OTP#2 → السائق يرفض OTP#1.
  //
  //    الإصلاح الآن: نُفحص أولاً خارج الـ transaction (للأداء)، ثم نُعيد الفحص داخل
  //    الـ transaction (للأمان). إذا وجدنا OTP صالحة في أي مرحلة → نُعيدها مباشرةً.
  //    هذا يعني: مهما كان عدد الطلبات المتزامنة، لن تُنشأ سوى OTP واحدة صالحة.
  //
  //    الخيار forceNew=true مُتاح للمشرف عند الحاجة لتجديد OTP يدوياً بغض النظر.
  //
  // ⚠️ خطأ جديد تكشفه هذا الإصلاح:
  //    إذا انقضت صلاحية OTP وكان المستخدم لا يُحدّث الصفحة، سيظل يرى الرمز القديم
  //    حتى يُعيد التحميل — لأن getOrderWithSubOrders يُعيد الآن OTP الموجودة فقط
  //    بدلاً من توليد رمز جديد في كل استعلام. الواجهة تحتاج لزر "تجديد الرمز"
  //    يستدعي POST /api/orders/suborders/:id/regenerate-otp مع forceNew=true.
  async generateOtp(orderId: string, subOrderId?: string, forceNew = false): Promise<string> {
    // Step 1 — fast non-transactional read: return early if a valid OTP already exists
    if (!forceNew && subOrderId) {
      const [existingOtp] = await db
        .select({ otpCode: deliveryOtps.otpCode })
        .from(deliveryOtps)
        .where(and(
          eq(deliveryOtps.subOrderId, subOrderId),
          eq(deliveryOtps.status, "PENDING"),
          gt(deliveryOtps.expiresAt, new Date())
        ))
        .limit(1);

      if (existingOtp) {
        return existingOtp.otpCode;
      }
    }

    const newOtpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    // Step 2 — transactional double-check + insert
    // `finalCode` is a let in the outer scope, reassignable from inside the tx callback.
    // This is safe because Node.js is single-threaded and the transaction Promise resolves
    // synchronously within the current event loop micro-task before we return finalCode.
    let finalCode = newOtpCode;

    await db.transaction(async (tx) => {
      // Re-check inside the transaction: another concurrent request may have already
      // inserted a valid OTP during the window between Step 1 and this transaction.
      if (!forceNew && subOrderId) {
        const [recheckOtp] = await tx
          .select({ otpCode: deliveryOtps.otpCode })
          .from(deliveryOtps)
          .where(and(
            eq(deliveryOtps.subOrderId, subOrderId),
            eq(deliveryOtps.status, "PENDING"),
            gt(deliveryOtps.expiresAt, new Date())
          ))
          .limit(1);

        if (recheckOtp) {
          // Q: كيف نُمرّر قيمة من داخل tx callback للخارج دون رمي استثناء؟
          // A: نستخدم `let finalCode` في الـ outer scope. الـ callback يُعدّل المتغير
          //    مباشرةً عبر closure. هذا يعمل لأن await tx() لن يُحسم إلا بعد انتهاء
          //    الـ callback كاملاً، فنضمن أن finalCode مُعدَّل قبل العودة من generateOtp.
          finalCode = recheckOtp.otpCode;
          return; // exit transaction early — no DB writes needed
        }
      }

      // Auto-invalidate old PENDING OTPs for this sub_order before inserting new one
      if (subOrderId) {
        await tx.update(deliveryOtps)
          .set({ status: "EXPIRED", updatedAt: new Date() })
          .where(and(
            eq(deliveryOtps.subOrderId, subOrderId),
            eq(deliveryOtps.status, "PENDING")
          ));
      }

      await tx.insert(deliveryOtps).values({
        orderId,
        subOrderId,
        otpCode: newOtpCode,
        status: "PENDING",
        expiresAt,
        attemptCount: 0
      });
    });

    if (finalCode !== newOtpCode) {
      // Race condition was resolved — an existing OTP was found inside the transaction
      return finalCode;
    }

    console.log(JSON.stringify({
      event: "OTP_GENERATED",
      orderId,
      subOrderId,
      timestamp: new Date().toISOString(),
      success: true
    }));

    return newOtpCode;
  }

  async verifyOtp(orderId: string, otpCode: string, subOrderId?: string): Promise<void> {
    const now = new Date();
    const baseWhere = and(
      eq(deliveryOtps.orderId, orderId),
      eq(deliveryOtps.status, "PENDING"),
      gt(deliveryOtps.expiresAt, now),
      lt(deliveryOtps.attemptCount, 5),
      subOrderId ? eq(deliveryOtps.subOrderId, subOrderId) : undefined
    );

    // BUG-FIX: TOCTOU race condition — previously the OTP was read outside a transaction,
    // then verified and updated in a separate transaction. Two concurrent correct submissions
    // could both pass the read check and both mark the order as delivered.
    // Fix: wrap the entire check + update in one atomic transaction with SELECT FOR UPDATE.
    await db.transaction(async (tx) => {
      const [otpRecord] = await tx.select()
        .from(deliveryOtps)
        .where(baseWhere)
        .for("update")
        .limit(1);

      if (!otpRecord) {
        throw new Error("Invalid, expired, or too many attempts");
      }

      if (otpRecord.otpCode !== otpCode) {
        const newAttemptCount = otpRecord.attemptCount + 1;
        const newStatus = newAttemptCount >= 5 ? "EXPIRED" : "PENDING";

        await tx.update(deliveryOtps)
          .set({ attemptCount: newAttemptCount, status: newStatus, updatedAt: new Date() })
          .where(eq(deliveryOtps.id, otpRecord.id));

        console.log(JSON.stringify({
          event: "OTP_VERIFICATION_FAILED",
          orderId,
          subOrderId,
          timestamp: new Date().toISOString(),
          reason: newStatus === "EXPIRED" ? "MAX_ATTEMPTS_EXCEEDED" : "INVALID_OTP_CODE",
          success: false
        }));
        throw new Error(newStatus === "EXPIRED" ? "Maximum attempts exceeded" : "Invalid OTP code");
      }

      // Mark OTP as verified
      await tx.update(deliveryOtps)
        .set({ status: "VERIFIED", updatedAt: new Date() })
        .where(eq(deliveryOtps.id, otpRecord.id));

      if (subOrderId) {
        await tx.update(subOrders)
          .set({ status: "DELIVERED", updatedAt: new Date() })
          .where(eq(subOrders.id, subOrderId));

        const allSubs = await tx.select({ id: subOrders.id, status: subOrders.status })
          .from(subOrders)
          .where(eq(subOrders.orderId, orderId));

        const allDone = allSubs.every(s =>
          s.id === subOrderId ? true : (s.status === "DELIVERED" || s.status === "CANCELLED")
        );

        if (allDone) {
          const anyDelivered = allSubs.some(s =>
            s.id === subOrderId ? true : s.status === "DELIVERED"
          );
          await tx.update(orders)
            .set({ overallStatus: anyDelivered ? "DELIVERED" : "CANCELLED", updatedAt: new Date() })
            .where(eq(orders.id, orderId));
        }
      } else {
        await tx.update(orders)
          .set({ overallStatus: "DELIVERED", updatedAt: new Date() })
          .where(eq(orders.id, orderId));
      }
    });

    // Trigger commissions OUTSIDE the transaction to avoid nested-transaction deadlock.
    // BUG-FIX: processCommissions was not wrapped in a try/catch. If it threw ALREADY_PROCESSED
    // (e.g., due to a concurrent call or a retry), the error propagated all the way to the HTTP
    // handler and the driver received HTTP 500 even though OTP verification already succeeded and
    // the sub-order was already marked DELIVERED in the database. The fix catches ALREADY_PROCESSED
    // and logs it instead of re-throwing, since idempotency is the desired behaviour here.
    // Any other unexpected error is still re-thrown so real failures are not silently swallowed.
    //
    // Q: هل تُعالَج العمولات عند استدعاء verifyOtp بدون subOrderId؟
    // A: لا — processCommissions تحتاج subOrderId بشكل أساسي (جلب الطلب الفرعي، السائق
    //    المُسنَد، ومبلغ التوصيل). بدون subOrderId لا يمكن معرفة أي السائقين وأصحاب
    //    المتاجر يستحقون العمولة، فلا تُعالَج العمولات إطلاقاً.
    //    الوضع الحالي: deliveryOtp.controller.ts يُمرّر subOrderId دائماً عند التحقق من
    //    التسليم، لذا هذه الحالة نظرية ولا تحدث في الإنتاج.
    if (subOrderId) {
      try {
        await ledgerService.processCommissions(subOrderId);
      } catch (err: any) {
        if (err.message === "ALREADY_PROCESSED") {
          console.log(`[OTP] Commissions already processed for sub-order ${subOrderId} — skipping.`);
        } else {
          throw err;
        }
      }
    } else {
      console.warn(`[OTP] verifyOtp called without subOrderId for orderId=${orderId}. Commissions will NOT be processed. Verify this is intentional.`);
    }

    console.log(JSON.stringify({
      event: "OTP_VERIFICATION_SUCCESS",
      orderId,
      subOrderId,
      timestamp: new Date().toISOString(),
      success: true
    }));
  }
}

export const deliveryOtpService = new DeliveryOtpService();
