import { db } from "../../db";
import { deliveryOtps, subOrders, orders } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { ledgerService } from "../ledger/ledger.service";

export class DeliveryOtpService {
  async generateOtp(orderId: string, subOrderId?: string): Promise<string> {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    await db.insert(deliveryOtps).values({
      orderId,
      subOrderId,
      otpCode,
      status: "PENDING"
    });

    return otpCode;
  }

  async verifyOtp(orderId: string, otpCode: string, subOrderId?: string): Promise<void> {
    const [otpRecord] = await db.select()
      .from(deliveryOtps)
      .where(and(
        eq(deliveryOtps.orderId, orderId),
        otpCode === otpCode ? eq(deliveryOtps.otpCode, otpCode) : undefined as any,
        subOrderId ? eq(deliveryOtps.subOrderId, subOrderId) : undefined as any,
        eq(deliveryOtps.status, "PENDING")
      ));

    if (!otpRecord || otpRecord.otpCode !== otpCode) {
      throw new Error("Invalid or expired OTP");
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
    });
  }
}

export const deliveryOtpService = new DeliveryOtpService();
