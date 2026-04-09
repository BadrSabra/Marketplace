import { Request, Response } from "express";
import { deliveryOtpService } from "./deliveryOtp.service";
import { z } from "zod";
import { db } from "../../db";
import { subOrders } from "@shared/schema";
import { eq } from "drizzle-orm";

// Q: لماذا يحتاج هذا الملف إلى z من zod؟
// A: استُخدم z.ZodError في كتلة catch ضمن verify() للتمييز بين أخطاء التحقق من
//    صحة بيانات الإدخال (يجب أن تُرجع 400) وأخطاء السيرفر (يجب أن تُرجع 500).
//    z كان مستورداً بالفعل للـ verifySchema وgenerateSchema في هذا الملف.

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
      // Q: هل يجب أن يُرجع التحقق من OTP دائماً 400 عند الفشل؟
      // A: لا — الكود السابق كان يُرجع 400 لجميع أخطاء التحقق، بما فيها:
      //    - أخطاء Zod (بيانات إدخال غير صالحة) → 400 صحيح
      //    - خطأ "Invalid OTP code" أو "Maximum attempts exceeded" → 400 صحيح
      //    - أخطاء DB (فشل processCommissions، أخطاء الاتصال) → يجب 500
      //    إن أُرجعت أخطاء السيرفر كـ 400، يعتقد العميل أن الطلب كان خاطئاً فيعيد
      //    المحاولة بنفس البيانات، مما يستنزف محاولات OTP المتاحة (5 محاولات) عبثاً.
      //    الإصلاح: التمييز بين أخطاء العميل المعروفة وأخطاء السيرفر غير المتوقعة.
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      const msg: string = error.message || "";
      const isClientError =
        msg.includes("Invalid") ||
        msg.includes("expired") ||
        msg.includes("attempts");
      res.status(isClientError ? 400 : 500).json({ message: msg });
    }
  }
}

export const deliveryOtpController = new DeliveryOtpController();
