import { Request, Response } from "express";
import { orderService } from "./order.service";
import { z } from "zod";
import { db } from "../../db";
import { stores } from "@shared/schema";
import { inArray, and, eq } from "drizzle-orm";

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().min(1)
  })).min(1)
});

// Q: هل يجب التحقق من صحة UUID في معرّفات الطلبات قبل تمريرها لقاعدة البيانات؟
// A: نعم بالتأكيد — PostgreSQL يُرجع خطأ 500 غير واضح عند تمرير UUID غير صالح
//    (مثل "abc" أو سلسلة فارغة) بدلاً من 400 واضح. هذا يُربك العميل ويُخفي
//    السبب الحقيقي للخطأ. الإصلاح: التحقق من UUID بـ regex قبل أي استعلام DB.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

export class OrderController {
  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { items } = createOrderSchema.parse(req.body);
      const order = await orderService.createMultiStoreOrder(userId, items);
      res.status(201).json(order);
    } catch (error: any) {
      // BUG-FIX: Was returning 400 for ALL errors, including server-side failures like DB
      // connection errors, which should be 500. Now routes client-facing errors (ZodError,
      // known business rule messages) to 400 and everything else to 500.
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      const msg: string = error.message || "";
      const isClientError =
        msg.includes("not found") ||
        msg.includes("Not enough stock") ||
        msg.includes("Insufficient wallet") ||
        msg.includes("One or more products");
      res.status(isClientError ? 400 : 500).json({ message: msg });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      if (!isValidUuid(id)) {
        return res.status(400).json({ message: "معرّف الطلب غير صالح" });
      }
      const actor = (req as any).user;
      const order = await orderService.getOrderWithSubOrders(id);

      // BUG-FIX: No authorization check — any authenticated user could read any order by ID,
      // exposing customer PII, OTP codes, and financial details to unrelated users.
      // Now verifies the requester is: the order's customer, a store owner with a sub-order
      // in this order, the assigned driver on any sub-order, or an admin.
      if (actor.role !== "ADMIN") {
        const isCustomer = order.customerId === actor.id;

        const isDriver = order.subOrders?.some(
          (s: any) => s.assignedDriverId === actor.id
        );

        // For STORE_OWNER: fetch which stores they own and check if any sub-order belongs to one
        let isStoreOwner = false;
        if (actor.role === "STORE_OWNER" && order.subOrders?.length > 0) {
          const storeIds = order.subOrders.map((s: any) => s.storeId).filter(Boolean);
          if (storeIds.length > 0) {
            const ownerStores = await db
              .select({ id: stores.id })
              .from(stores)
              .where(and(inArray(stores.id, storeIds), eq(stores.ownerId, actor.id)));
            const ownedIds = new Set(ownerStores.map(s => s.id));
            isStoreOwner = order.subOrders.some((s: any) => ownedIds.has(s.storeId));
          }
        }

        if (!isCustomer && !isStoreOwner && !isDriver) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      res.json(order);
    } catch (error: any) {
      if (error.message === "Order not found") {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  }

  async getMyOrders(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const orders = await orderService.getCustomerOrders(userId);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getMyStoreOrders(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const orders = await orderService.getStoreOwnerOrders(userId);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async cancelSubOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;
      if (!isValidUuid(id)) {
        return res.status(400).json({ message: "معرّف الطلب الفرعي غير صالح" });
      }
      await orderService.cancelSubOrder(id, userId);
      res.json({ message: "SubOrder cancelled and refunded if applicable" });
    } catch (error: any) {
      // Q: هل يجب إرجاع 400 لجميع أخطاء إلغاء الطلب الفرعي؟
      // A: لا — الكود السابق كان يُرجع 400 لجميع الأخطاء دون استثناء، مما يُخفي:
      //    - أخطاء التفويض ("Unauthorized") التي يجب أن تُرجع 403
      //    - حالات عدم وجود الطلب ("SubOrder not found") التي يجب أن تُرجع 404
      //    - تعارضات الحالة ("Cannot cancel delivered/in-transit") التي يجب أن تُرجع 409
      //    - أخطاء السيرفر الداخلية ("WALLET_NOT_FOUND") التي يجب أن تُرجع 500
      //    الإصلاح: تمييز كل حالة وإرجاع كود HTTP مناسب لكل منها.
      const msg: string = error.message || "";
      if (msg === "SubOrder not found") {
        return res.status(404).json({ message: "الطلب الفرعي غير موجود" });
      }
      if (msg === "Unauthorized") {
        return res.status(403).json({ message: "غير مصرح بإلغاء هذا الطلب" });
      }
      if (
        msg === "Sub-order already cancelled" ||
        msg === "Cannot cancel delivered sub-order" ||
        msg === "Cannot cancel sub-order that is already in transit"
      ) {
        return res.status(409).json({ message: msg });
      }
      if (msg.startsWith("WALLET_NOT_FOUND")) {
        return res.status(500).json({ message: "خطأ داخلي: لم يمكن معالجة الاسترداد" });
      }
      res.status(500).json({ message: "حدث خطأ داخلي" });
    }
  }
}

export const orderController = new OrderController();
