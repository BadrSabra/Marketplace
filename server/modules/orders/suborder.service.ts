import { db } from "../../db";
import { subOrders, stores, orderItems, products, deliveryOffers, users, orders, deliveryOtps, wallets, walletTransactions } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { User, SubOrder } from "@shared/schema";
import { auditService } from "../../services/auditService";
import { allowedTransitions } from "./suborder.types";
import { notifyUser, notifyAllDrivers } from "../notifications/push.service";

export class SubOrderService {
  // ... (existing code)

  validateSubOrderTransition(currentStatus: string, nextStatus: string) {
    const allowed: Record<string, string[]> = {
      'PENDING': ['ACCEPTED', 'CANCELLED'],
      'ACCEPTED': ['IN_TRANSIT', 'CANCELLED'],
      'IN_TRANSIT': ['DELIVERED'],
      'DELIVERED': [],
      'CANCELLED': []
    };

    if (!allowed[currentStatus]?.includes(nextStatus)) {
      console.error(`[BLOCK] Illegal status transition: ${currentStatus} -> ${nextStatus}`);
      throw new Error(`BUSINESS_RULE_VIOLATION: Illegal state transition from ${currentStatus} to ${nextStatus}`);
    }
  }

  async updateSubOrderStatus(subOrderId: string, newStatus: any, actorUser: User): Promise<any> {
    const result = await db.transaction(async (tx) => {
      const [subOrder] = await tx
        .select()
        .from(subOrders)
        .where(eq(subOrders.id, subOrderId))
        .for("update");

      if (!subOrder) throw new Error("NOT_FOUND");

      // 4️⃣ SUBORDER STATE TRANSITION GUARD
      this.validateSubOrderTransition(subOrder.status, newStatus);

      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, subOrder.orderId));
      const [customer] = await tx.select().from(users).where(eq(users.id, parentOrder.customerId));

      // ... (validation code)

      // 4. Update status
      const [updatedSubOrder] = await tx
        .update(subOrders)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(subOrders.id, subOrderId))
        .returning();

      // 5. Refund customer wallet if sub-order is cancelled and payment was made
      if (newStatus === "CANCELLED" && parentOrder.paymentStatus === "PAID") {
        const [customerWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, parentOrder.customerId));

        if (customerWallet) {
          const newBalance = (parseFloat(customerWallet.balance) + parseFloat(subOrder.subtotal)).toFixed(2);
          await tx
            .update(wallets)
            .set({ balance: newBalance, updatedAt: new Date() })
            .where(eq(wallets.id, customerWallet.id));

          await tx.insert(walletTransactions).values({
            walletId: customerWallet.id,
            type: "REFUND",
            amount: subOrder.subtotal,
            relatedOrderId: parentOrder.id,
            status: "COMPLETED",
            notes: `استرداد تلقائي - إلغاء طلب فرعي #${subOrderId.slice(0, 8)} من المتجر`,
          });

          console.log(`[SubOrderService] Refunded ${subOrder.subtotal} to customer wallet for cancelled sub-order ${subOrderId}`);
        }
      }

      // 6. Audit & Logging
      // ... (existing code)

      // 7. Notifications
      if (customer) {
        const statusMessages: Record<string, string> = {
          ACCEPTED: "تم قبول طلبك من المتجر",
          IN_TRANSIT: "طلبك في الطريق إليك",
          DELIVERED: "تم تسليم طلبك بنجاح",
          CANCELLED: "تم إلغاء طلبك",
        };
        const statusTitles: Record<string, string> = {
          ACCEPTED: "تم قبول الطلب",
          IN_TRANSIT: "الطلب في الطريق",
          DELIVERED: "تم التسليم",
          CANCELLED: "تم الإلغاء",
        };
        if (statusMessages[newStatus]) {
          notifyUser(
            customer.id,
            "ORDER_STATUS_UPDATE",
            statusTitles[newStatus] || "تحديث الطلب",
            statusMessages[newStatus],
            { subOrderId, newStatus }
          ).catch(console.error);
        }
      }

      // Also notify assigned driver if order is delivered
      if (newStatus === "DELIVERED" && updatedSubOrder.assignedDriverId) {
        notifyUser(
          updatedSubOrder.assignedDriverId,
          "ORDER_STATUS_UPDATE",
          "تم التسليم",
          "تم تأكيد تسليم الطلب بنجاح وسيتم إضافة أرباحك",
          { subOrderId, newStatus }
        ).catch(console.error);
      }

      return {
        // ... (existing code)
      };
    });

    if (newStatus === "ACCEPTED") {
      notifyAllDrivers(
        "NEW_ORDER",
        "مهمة توصيل جديدة متاحة",
        "طلب جديد متاح للتوصيل، قدّم عرضك الآن",
        { subOrderId }
      ).catch(console.error);
    }

    return result;
  }

  async getActiveDeliveryForDriver(driverId: string) {
    const [activeSubOrder] = await db
      .select({
        id: subOrders.id,
        orderId: subOrders.orderId,
        status: subOrders.status,
        subtotal: subOrders.subtotal,
        customerName: users.name,
        customerPhone: users.phone,
      })
      .from(subOrders)
      .innerJoin(orders, eq(subOrders.orderId, orders.id))
      .innerJoin(users, eq(orders.customerId, users.id))
      .where(
        and(
          eq(subOrders.assignedDriverId, driverId),
          inArray(subOrders.status, ["ACCEPTED", "IN_TRANSIT"])
        )
      )
      .limit(1);

    if (!activeSubOrder) return null;

    const items = await db
      .select({
        productName: products.name,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.subOrderId, activeSubOrder.id));

    const [otpRecord] = await db
      .select()
      .from(deliveryOtps)
      .where(eq(deliveryOtps.subOrderId, activeSubOrder.id))
      .limit(1);

    return {
      ...activeSubOrder,
      items,
      hasOtp: !!otpRecord,
    };
  }
}

export const subOrderService = new SubOrderService();
