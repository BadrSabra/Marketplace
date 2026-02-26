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
  orderId: z.string().uuid(),
  subOrderId: z.string().uuid().optional(),
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
      const { id: subOrderId } = req.params;
      const [subOrder] = await db.select().from(subOrders).where(eq(subOrders.id, subOrderId));
      if (!subOrder) return res.status(404).json({ error: "Sub-order not found" });

      const otpCode = await deliveryOtpService.generateOtp(subOrder.orderId, subOrderId);
      res.json({ otpCode });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async verify(req: Request, res: Response) {
    try {
      const { orderId, subOrderId, otpCode } = verifySchema.parse(req.body);
      await deliveryOtpService.verifyOtp(orderId, otpCode, subOrderId);
      res.json({ message: "Delivery verified successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}

export const deliveryOtpController = new DeliveryOtpController();
