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
      const subOrderId = req.params.id as string;
      const driverId = (req as any).user.id as string;
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
      const subOrderId = req.params.id as string;
      const customerId = (req as any).user.id as string;

      // Q: هل يجب التحقق من أن العميل يمتلك هذا الطلب الفرعي قبل إعادة العروض؟
      // A: نعم — بدون هذا الفحص يستطيع أي عميل مُصادَق عليه عرض جميع عروض التوصيل
      //    لأي طلب فرعي بمجرد معرفة UUID الخاص به (عن طريق التخمين أو القرصنة).
      //    هذا يُكشف معلومات حساسة مثل أسماء السائقين وأرقام هواتفهم وأسعار عروضهم
      //    لعملاء غير مصرح لهم. الإصلاح: جلب الطلب الفرعي والطلب الأصلي والتحقق
      //    من أن customerId الخاص بالطلب يطابق هوية العميل المُصادَق عليه حالياً.
      const ownership = await deliveryOfferService.verifySubOrderOwnership(subOrderId, customerId);
      if (!ownership) {
        return res.status(403).json({ error: "غير مصرح: هذا الطلب الفرعي لا ينتمي إليك" });
      }

      const offers = await deliveryOfferService.getOffersForSubOrder(subOrderId);
      res.json(offers);
    } catch (err: any) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async customerAcceptOffer(req: Request, res: Response) {
    try {
      const offerId = req.params.offerId as string;
      const customerId = (req as any).user.id as string;
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
      const offerId = req.params.offerId as string;
      const customerId = (req as any).user.id as string;
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
      const offerId = req.params.offerId as string;
      const customerId = (req as any).user.id as string;
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
      if (err.message === "COUNTER_FEE_MUST_BE_POSITIVE") {
        return res.status(400).json({ error: "يجب أن تكون رسوم العرض المضاد أكبر من الصفر" });
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

  async driverAcceptCounterOffer(req: Request, res: Response) {
    try {
      const offerId = req.params.offerId as string;
      const driverId = (req as any).user.id as string;
      const result = await deliveryOfferService.driverAcceptCounterOffer(offerId, driverId);
      res.json(result);
    } catch (err: any) {
      if (err.message === "OFFER_NOT_COUNTERED") {
        return res.status(400).json({ error: "هذا العرض ليس في حالة عرض مضاد" });
      }
      if (err.message === "UNAUTHORIZED") {
        return res.status(403).json({ error: "غير مصرح" });
      }
      if (err.message === "COUNTER_FEE_MISSING") {
        return res.status(400).json({ error: "لا يوجد سعر مضاد محدد" });
      }
      if (err.message === "SUBORDER_NOT_AVAILABLE") {
        return res.status(400).json({ error: "الطلب الفرعي لم يعد متاحاً" });
      }
      if (err.message === "ALREADY_ASSIGNED") {
        return res.status(409).json({ error: "تم تعيين سائق لهذا الطلب بالفعل" });
      }
      if (err.message === "INSUFFICIENT_BALANCE") {
        return res.status(402).json({ error: "رصيد محفظة العميل غير كافٍ لرسوم التوصيل" });
      }
      if (err.message === "WALLET_NOT_FOUND") {
        return res.status(404).json({ error: "محفظة العميل غير موجودة" });
      }
      console.error("Error accepting counter offer:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // ─── ORDER-LEVEL OFFER CONTROLLERS ─────────────────────────────────────────

  async submitOrderOffer(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId as string;
      const driverId = (req as any).user.id as string;
      const schema = z.object({ proposedFee: z.coerce.number().positive("Fee must be a positive number") });
      const { proposedFee } = schema.parse(req.body);
      const offers = await deliveryOfferService.createOrderOffer(orderId, driverId, proposedFee);
      res.status(201).json(offers);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      if (err.message === "ALREADY_SUBMITTED") return res.status(409).json({ error: "لقد قدمت عرضاً بالفعل على هذا الطلب" });
      if (err.message === "NO_ELIGIBLE_SUBORDERS") return res.status(400).json({ error: "لا توجد طلبات فرعية مؤهلة للتوصيل" });
      if (err.message === "DRIVER_NOT_APPROVED") return res.status(403).json({ error: "حساب السائق غير معتمد" });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getOffersForOrder(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId as string;
      const customerId = (req as any).user.id as string;
      const offers = await deliveryOfferService.getOffersForOrder(orderId, customerId);
      res.json(offers);
    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") return res.status(403).json({ error: "غير مصرح" });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async customerAcceptOrderOffer(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId as string;
      const customerId = (req as any).user.id as string;
      const schema = z.object({ driverId: z.string().min(1) });
      const { driverId } = schema.parse(req.body);
      const result = await deliveryOfferService.customerAcceptOrderOffer(orderId, driverId, customerId);
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      if (err.message === "OFFER_NOT_AVAILABLE") return res.status(400).json({ error: "هذا العرض لم يعد متاحاً" });
      if (err.message === "NO_SUBORDERS_AVAILABLE") return res.status(400).json({ error: "لا توجد طلبات فرعية متاحة للتوصيل" });
      if (err.message === "UNAUTHORIZED") return res.status(403).json({ error: "غير مصرح" });
      if (err.message === "INSUFFICIENT_BALANCE") return res.status(402).json({ error: "رصيد المحفظة غير كافٍ لرسوم التوصيل. يرجى شحن المحفظة أولاً." });
      if (err.message === "WALLET_NOT_FOUND") return res.status(404).json({ error: "المحفظة غير موجودة" });
      console.error("Error accepting order offer:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async customerRejectOrderOffer(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId as string;
      const customerId = (req as any).user.id as string;
      const schema = z.object({ driverId: z.string().min(1) });
      const { driverId } = schema.parse(req.body);
      const result = await deliveryOfferService.customerRejectOrderOffer(orderId, driverId, customerId);
      res.json(result);
    } catch (err: any) {
      if (err.message === "OFFER_NOT_AVAILABLE") return res.status(400).json({ error: "هذا العرض لم يعد متاحاً" });
      if (err.message === "UNAUTHORIZED") return res.status(403).json({ error: "غير مصرح" });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async customerCounterOrderOffer(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId as string;
      const customerId = (req as any).user.id as string;
      const schema = z.object({
        driverId: z.string().min(1),
        counterFee: z.coerce.number().positive("يجب أن يكون السعر رقماً موجباً"),
      });
      const { driverId, counterFee } = schema.parse(req.body);
      const result = await deliveryOfferService.customerCounterOrderOffer(orderId, driverId, customerId, counterFee);
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      if (err.message === "OFFER_NOT_AVAILABLE") return res.status(400).json({ error: "هذا العرض لم يعد متاحاً" });
      if (err.message === "COUNTER_FEE_MUST_BE_POSITIVE") return res.status(400).json({ error: "يجب أن تكون رسوم العرض المضاد أكبر من الصفر" });
      if (err.message === "COUNTER_MUST_BE_LOWER") return res.status(400).json({ error: "يجب أن يكون العرض المضاد أقل من السعر المقترح من السائق" });
      if (err.message === "UNAUTHORIZED") return res.status(403).json({ error: "غير مصرح" });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async driverAcceptOrderCounterOffer(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId as string;
      const driverId = (req as any).user.id as string;
      const result = await deliveryOfferService.driverAcceptOrderCounterOffer(orderId, driverId);
      res.json(result);
    } catch (err: any) {
      if (err.message === "OFFER_NOT_COUNTERED") return res.status(400).json({ error: "لا يوجد عرض مضاد من العميل" });
      if (err.message === "SUBORDER_NOT_AVAILABLE") return res.status(400).json({ error: "الطلب الفرعي لم يعد متاحاً" });
      if (err.message === "INSUFFICIENT_BALANCE") return res.status(402).json({ error: "رصيد محفظة العميل غير كافٍ" });
      if (err.message === "WALLET_NOT_FOUND") return res.status(404).json({ error: "محفظة العميل غير موجودة" });
      if (err.message === "COUNTER_FEE_MISSING") return res.status(400).json({ error: "لا يوجد سعر مضاد محدد" });
      console.error("Error accepting order counter offer:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async acceptTask(req: Request, res: Response) {
    try {
      const subOrderId = req.params.id as string;
      const driverId = (req as any).user.id as string;

      const result = await deliveryOfferService.acceptTask(subOrderId, driverId);
      res.json(result);
    } catch (err: any) {
      if (err.message === "ALREADY_ASSIGNED") {
        return res.status(409).json({ error: "Task has already been assigned" });
      }
      if (err.message === "NOT_FOUND") {
        return res.status(404).json({ error: "Task not found" });
      }
      if (err.message === "TASK_NOT_AVAILABLE") {
        return res.status(400).json({ error: "هذه المهمة غير متاحة للقبول" });
      }
      if (err.message === "DRIVER_NOT_APPROVED") {
        return res.status(403).json({ error: "Driver account not approved" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const deliveryOfferController = new DeliveryOfferController();
