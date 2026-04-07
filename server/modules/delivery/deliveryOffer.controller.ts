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
        return res.status(409).json({ error: "لقد قدمت عرضاً بالفعل على هذه المهمة" });
      }
      if (err.message === "TASK_NOT_AVAILABLE") {
        return res.status(400).json({ error: "هذه المهمة غير متاحة" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getOffersForSubOrder(req: Request, res: Response) {
    try {
      const { id: subOrderId } = req.params;
      const offers = await deliveryOfferService.getOffersForSubOrder(subOrderId);
      res.json(offers);
    } catch (err: any) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async customerAcceptOffer(req: Request, res: Response) {
    try {
      const { offerId } = req.params;
      const customerId = (req as any).user.id;
      const result = await deliveryOfferService.customerAcceptOffer(offerId, customerId);
      res.json(result);
    } catch (err: any) {
      if (err.message === "OFFER_NOT_AVAILABLE") {
        return res.status(400).json({ error: "هذا العرض لم يعد متاحاً" });
      }
      if (err.message === "SUBORDER_NOT_AVAILABLE") {
        return res.status(400).json({ error: "الطلب الفرعي لم يعد متاحاً للتوصيل" });
      }
      if (err.message === "ALREADY_ASSIGNED") {
        return res.status(409).json({ error: "تم تعيين سائق لهذا الطلب بالفعل" });
      }
      if (err.message === "UNAUTHORIZED") {
        return res.status(403).json({ error: "غير مصرح" });
      }
      if (err.message === "INSUFFICIENT_BALANCE") {
        return res.status(402).json({ error: "رصيد المحفظة غير كافٍ لرسوم التوصيل. يرجى شحن المحفظة أولاً." });
      }
      if (err.message === "WALLET_NOT_FOUND") {
        return res.status(404).json({ error: "المحفظة غير موجودة" });
      }
      console.error("Error accepting offer:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async customerRejectOffer(req: Request, res: Response) {
    try {
      const { offerId } = req.params;
      const customerId = (req as any).user.id;
      const result = await deliveryOfferService.customerRejectOffer(offerId, customerId);
      res.json(result);
    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") {
        return res.status(403).json({ error: "غير مصرح" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async customerCounterOffer(req: Request, res: Response) {
    try {
      const { offerId } = req.params;
      const customerId = (req as any).user.id;
      const schema = z.object({ counterFee: z.coerce.number().positive("يجب أن يكون السعر رقماً موجباً") });
      const { counterFee } = schema.parse(req.body);
      const result = await deliveryOfferService.customerCounterOffer(offerId, customerId, counterFee);
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.errors[0].message });
      }
      if (err.message === "OFFER_NOT_AVAILABLE") {
        return res.status(400).json({ error: "هذا العرض لم يعد متاحاً" });
      }
      if (err.message === "COUNTER_MUST_BE_LOWER") {
        return res.status(400).json({ error: "يجب أن يكون العرض المضاد أقل من السعر المقترح من السائق" });
      }
      if (err.message === "UNAUTHORIZED") {
        return res.status(403).json({ error: "غير مصرح" });
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
