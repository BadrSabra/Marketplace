import { Request, Response } from "express";
import { deliveryOfferService } from "./deliveryOffer.service";
import { z } from "zod";

const offerSchema = z.object({
  proposedFee: z.coerce.number().positive("Fee must be a positive number"),
  notes: z.string().optional(),
});

export class DeliveryOfferController {
  async submitOffer(req: Request, res: Response) {
    try {
      const { id: subOrderId } = req.params;
      const driverId = (req as any).user.id;
      const validated = offerSchema.parse(req.body);

      const offer = await deliveryOfferService.createOffer(subOrderId, driverId, validated);
      res.status(201).json(offer);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.errors[0].message });
      }
      if (err.message === "ALREADY_SUBMITTED") {
        return res.status(409).json({ error: "You have already submitted an offer for this task" });
      }
      if (err.message === "TASK_NOT_AVAILABLE") {
        return res.status(400).json({ error: "Task is no longer available" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async acceptTask(req: Request, res: Response) {
    try {
      const { id: subOrderId } = req.params;
      const driverId = (req as any).user.id;

      const result = await deliveryOfferService.acceptTask(subOrderId, driverId);
      res.json(result);
    } catch (err: any) {
      if (err.message === "ALREADY_ASSIGNED") {
        return res.status(409).json({ error: "Task has already been assigned" });
      }
      if (err.message === "NOT_FOUND") {
        return res.status(404).json({ error: "Task not found" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const deliveryOfferController = new DeliveryOfferController();
