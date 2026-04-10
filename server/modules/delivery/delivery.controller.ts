import { Request, Response } from "express";
import { deliveryService } from "./delivery.service";
import { z } from "zod";

const querySchema = z.object({
  page: z.string().optional().transform(v => v ? parseInt(v) : 1),
  limit: z.string().optional().transform(v => v ? parseInt(v) : 20),
  store_id: z.string().uuid().optional(),
  category: z.string().optional(),
});

export class DeliveryController {
  async getAvailableTasks(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || user.role !== "DRIVER") {
        return res.status(403).json({ error: "Unauthorized: Driver role required" });
      }

      const validated = querySchema.safeParse(req.query);
      if (!validated.success) {
        return res.status(400).json({ error: "Invalid query parameters", details: validated.error.errors });
      }

      const { tasks, total } = await deliveryService.getAvailableTasks(user.id, validated.data);
      
      res.json({
        tasks,
        pagination: {
          total,
          page: validated.data.page,
          limit: validated.data.limit,
        }
      });
    } catch (err: any) {
      if (err.message === "DRIVER_NOT_APPROVED") {
        return res.status(403).json({ error: "Driver account not approved" });
      }
      if (err.message === "UNAUTHORIZED_ROLE") {
        return res.status(403).json({ error: "Unauthorized role" });
      }
      console.error("[DeliveryController] Error fetching available tasks:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async getAvailableOrderTasks(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || user.role !== "DRIVER") {
        return res.status(403).json({ error: "Unauthorized: Driver role required" });
      }
      const tasks = await deliveryService.getAvailableOrderTasks(user.id);
      res.json(tasks);
    } catch (err: any) {
      if (err.message === "DRIVER_NOT_APPROVED") {
        return res.status(403).json({ error: "Driver account not approved" });
      }
      if (err.message === "UNAUTHORIZED_ROLE") {
        return res.status(403).json({ error: "Unauthorized role" });
      }
      console.error("[DeliveryController] Error fetching order tasks:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const deliveryController = new DeliveryController();
