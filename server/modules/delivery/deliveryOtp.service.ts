import { db } from "../../db";
import { deliveryOtps, subOrders, orders } from "@shared/schema";
import { eq, and, ne, lt, gt, inArray } from "drizzle-orm";
import { ledgerService } from "../ledger/ledger.service";
import crypto from "crypto";

export class DeliveryOtpService {
  async generateOtp(orderId: string, subOrderId?: string): Promise<string> {
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    
    await db.transaction(async (tx) => {
      // Auto-invalidate old PENDING OTPs for this sub_order
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
        otpCode,
        status: "PENDING",
        expiresAt,
        attemptCount: 0
      });
    });

    console.log(JSON.stringify({
      event: "OTP_GENERATED",
      orderId,
      subOrderId,
      timestamp: new Date().toISOString(),
      success: true
    }));

    return otpCode;
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
