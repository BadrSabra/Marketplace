import { Request, Response } from "express";
import { subOrderService } from "./suborder.service";
import { updateSubOrderStatusSchema } from "./suborder.dto";
import { z } from "zod";

export class SubOrderController {
  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validated = updateSubOrderStatusSchema.parse(req.body);
      const user = (req as any).user;

      const subOrder = await subOrderService.updateSubOrderStatus(id, validated.status, user);

      res.json({
        sub_order_id: subOrder.id,
        old_status: req.body.currentStatus, // Note: currentStatus should be fetched or passed if needed, but the service handles the transition logic
        new_status: subOrder.status,
        updated_at: subOrder.updatedAt.toISOString(),
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid status input" });
      }
      if (err.message === "NOT_FOUND") {
        return res.status(404).json({ message: "Sub-order not found" });
      }
      if (err.message === "INVALID_TRANSITION") {
        return res.status(400).json({ message: "Invalid status transition" });
      }
      if (err.message?.startsWith("UNAUTHORIZED")) {
        return res.status(403).json({ message: "Forbidden: insufficient permissions" });
      }
      if (err.message?.startsWith("INSUFFICIENT_STOCK")) {
        return res.status(409).json({ message: err.message });
      }
      console.error("SubOrder update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}

export const subOrderController = new SubOrderController();
