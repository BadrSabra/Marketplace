import { Request, Response } from "express";
import { subOrderService } from "./suborder.service";
import { updateSubOrderStatusSchema } from "./suborder.dto";
import { z } from "zod";

export class SubOrderController {
  async updateStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: "Invalid sub-order ID format" });
      }
      const validated = updateSubOrderStatusSchema.parse(req.body);
      const user = (req as any).user;

      const result = await subOrderService.updateSubOrderStatus(id, validated.status, user);

      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid status input" });
      }
      if (err.message === "NOT_FOUND") {
        return res.status(404).json({ error: "Sub-order not found" });
      }
      // Q: هل يجب معالجة خطأ PARENT_ORDER_NOT_FOUND كـ 404 أم 500؟
      // A: 404 — هذا خطأ بيانات تالفة (طلب فرعي يشير لطلب غير موجود)، وليس
      //    خطأ في السيرفر. إرجاع 404 يُعلم المستدعي أن الطلب المرجعي مفقود
      //    ويُميّزه عن أخطاء البنية الداخلية الحقيقية.
      if (err.message?.startsWith("PARENT_ORDER_NOT_FOUND")) {
        return res.status(404).json({ error: "Parent order not found" });
      }
      if (err.message === "INVALID_TRANSITION") {
        return res.status(400).json({ error: "Invalid status transition" });
      }
      if (err.message?.startsWith("UNAUTHORIZED")) {
        return res.status(403).json({ error: "Unauthorized to perform this action" });
      }
      if (err.message === "INSUFFICIENT_STOCK") {
        return res.status(409).json({
          error: "Insufficient stock for sub-order",
          details: err.details
        });
      }
      if (err.message === "INVALID_QUANTITY") {
        return res.status(400).json({ error: "Invalid quantity requested" });
      }
      console.error("SubOrder update error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getActiveDelivery(req: Request, res: Response) {
    try {
      const driverId = (req as any).user.id;
      const activeDelivery = await subOrderService.getActiveDeliveryForDriver(driverId);
      res.json(activeDelivery || null);
    } catch (err: any) {
      console.error("Error fetching active delivery:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const subOrderController = new SubOrderController();
