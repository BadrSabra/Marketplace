import { Request, Response } from "express";
import { deliveryOtpService } from "./deliveryOtp.service";
import { z } from "zod";
import { db } from "../../db";
import { subOrders } from "@shared/schema";
import { eq } from "drizzle-orm";

const generateSchema = z.object({
  orderId: z.string().uuid(),
  subOrderId: z.string().uuid().optional(),
});

const verifySchema = z.object({
  otpCode: z.string().length(6).regex(/^\d+$/),
});

export class DeliveryOtpController {
  async generate(req: Request, res: Response) {
    try {
      const { orderId, subOrderId } = generateSchema.parse(req.body);
      const otpCode = await deliveryOtpService.generateOtp(orderId, subOrderId);
      res.json({ otpCode });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async generateOtp(req: Request, res: Response) {
    try {
      const subOrderId = req.params.id as string;
      const driverId = (req as any).user?.id;

      const [subOrder] = await db.select().from(subOrders).where(eq(subOrders.id, subOrderId));
      if (!subOrder) return res.status(404).json({ error: "Sub-order not found" });

      if (subOrder.assignedDriverId !== driverId) {
        return res.status(403).json({ error: "لا يمكنك توليد رمز OTP لطلب غير مُسند إليك" });
      }

      if (subOrder.status !== "IN_TRANSIT") {
        return res.status(400).json({ error: "لا يمكن توليد OTP إلا للطلبات في حالة IN_TRANSIT" });
      }

      const otpCode = await deliveryOtpService.generateOtp(subOrder.orderId, subOrderId);
      res.json({ otpCode });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async verify(req: Request, res: Response) {
    try {
      const subOrderId = req.params.id as string;
      const driverId = (req as any).user?.id;
      const { otpCode } = verifySchema.parse(req.body);

      const [subOrder] = await db.select().from(subOrders).where(eq(subOrders.id, subOrderId));
      if (!subOrder) return res.status(404).json({ error: "Sub-order not found" });

      // BUG-FIX: Missing driver ownership check — any authenticated DRIVER could verify
      // OTP for any sub-order that was not theirs, marking it as DELIVERED and triggering
      // commission payouts to the wrong driver. Now enforced before calling verifyOtp.
      if (subOrder.assignedDriverId !== driverId) {
        return res.status(403).json({ error: "لا يمكنك التحقق من رمز OTP لطلب غير مُسند إليك" });
      }

      await deliveryOtpService.verifyOtp(subOrder.orderId, otpCode, subOrderId);
      res.json({ message: "Delivery verified successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}

export const deliveryOtpController = new DeliveryOtpController();
