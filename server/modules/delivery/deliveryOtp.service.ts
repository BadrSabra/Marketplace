import { db } from "../../db";
import { deliveryOtps, subOrders, orders } from "@shared/schema";
import { eq, and, ne, lt, gt } from "drizzle-orm";
import { ledgerService } from "../ledger/ledger.service";
import crypto from "crypto";

export class DeliveryOtpService {
  async generateOtp(orderId: string, subOrderId?: string): Promise<string> {
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    
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
    const [otpRecord] = await db.select()
      .from(deliveryOtps)
      .where(and(
        eq(deliveryOtps.orderId, orderId),
        subOrderId ? eq(deliveryOtps.subOrderId, subOrderId) : undefined as any,
        eq(deliveryOtps.status, "PENDING"),
        gt(deliveryOtps.expiresAt, now),
        lt(deliveryOtps.attemptCount, 5)
      ));

    if (!otpRecord) {
      throw new Error("Invalid, expired, or too many attempts");
    }

    if (otpRecord.otpCode !== otpCode) {
      const newAttemptCount = otpRecord.attemptCount + 1;
      const newStatus = newAttemptCount >= 5 ? "EXPIRED" : "PENDING";
      
      await db.update(deliveryOtps)
        .set({ 
          attemptCount: newAttemptCount, 
          status: newStatus,
          updatedAt: new Date() 
        })
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

    await db.transaction(async (tx) => {
      // Mark OTP as verified
      await tx.update(deliveryOtps)
        .set({ status: "VERIFIED", updatedAt: new Date() })
        .where(eq(deliveryOtps.id, otpRecord.id));

      if (subOrderId) {
        // Mark suborder as delivered
        await tx.update(subOrders)
          .set({ status: "DELIVERED", updatedAt: new Date() })
          .where(eq(subOrders.id, subOrderId));
        
        // Trigger commissions
        await ledgerService.processCommissions(subOrderId, orderId);
      } else {
        // Mark whole order as delivered if no subOrderId (simple case)
        await tx.update(orders)
          .set({ overallStatus: "DELIVERED", updatedAt: new Date() })
          .where(eq(orders.id, orderId));
      }

      console.log(JSON.stringify({
        event: "OTP_VERIFICATION_SUCCESS",
        orderId,
        subOrderId,
        timestamp: new Date().toISOString(),
        success: true
      }));
    });
  }
}

export const deliveryOtpService = new DeliveryOtpService();
