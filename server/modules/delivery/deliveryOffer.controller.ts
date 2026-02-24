import { Request, Response } from "express";
import { deliveryOfferService } from "./deliveryOffer.service";
import { z } from "zod";

const submitOfferSchema = z.object({
  subOrderId: z.string().uuid(),
  offeredFee: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0)
});

export class DeliveryOfferController {
  async submit(req: Request, res: Response) {
    try {
      const driverId = (req.user as any).id;
      const { subOrderId, offeredFee } = submitOfferSchema.parse(req.body);
      const offer = await deliveryOfferService.submitOffer(subOrderId, driverId, offeredFee);
      res.status(201).json(offer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async accept(req: Request, res: Response) {
    try {
      const customerId = (req.user as any).id;
      const { id } = req.params;
      await deliveryOfferService.acceptOffer(id, customerId);
      res.json({ message: "Offer accepted and funds held" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}

export const deliveryOfferController = new DeliveryOfferController();
