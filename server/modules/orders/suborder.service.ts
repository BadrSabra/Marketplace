import { db } from "../../db";
import { subOrders, stores, orderItems, products, deliveryOffers, users, orders, deliveryOtps, wallets, walletTransactions, ledger } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { User } from "@shared/schema";
import { auditService } from "../../services/auditService";
import { allowedTransitions, type SubOrderStatus } from "./suborder.types";
import { notifyUser, notifyAllDrivers } from "../notifications/push.service";

export class SubOrderService {

  validateSubOrderTransition(currentStatus: string, nextStatus: string) {
    const allowed = allowedTransitions[currentStatus as SubOrderStatus];
    if (!allowed || !allowed.includes(nextStatus as SubOrderStatus)) {
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

      this.validateSubOrderTransition(subOrder.status, newStatus);

      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, subOrder.orderId));
      const [customer] = await tx.select().from(users).where(eq(users.id, parentOrder.customerId));

      const isStoreOwner = actorUser.role === "STORE_OWNER";
      const isDriver = actorUser.role === "DRIVER";
      const isAdmin = actorUser.role === "ADMIN";

      if (isStoreOwner) {
        const [store] = await tx.select().from(stores).where(eq(stores.id, subOrder.storeId));
        if (!store || store.ownerId !== actorUser.id) {
          throw new Error("UNAUTHORIZED: Store owner does not own this sub-order");
        }
        if (!["ACCEPTED", "CANCELLED"].includes(newStatus)) {
          throw new Error("UNAUTHORIZED: Store owner can only ACCEPT or CANCEL sub-orders");
        }
      } else if (isDriver) {
        if (subOrder.assignedDriverId && subOrder.assignedDriverId !== actorUser.id) {
          throw new Error("UNAUTHORIZED: Driver not assigned to this sub-order");
        }
      } else if (!isAdmin) {
        throw new Error("UNAUTHORIZED: Insufficient role");
      }

      const [updatedSubOrder] = await tx
        .update(subOrders)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(subOrders.id, subOrderId))
        .returning();

      if (newStatus === "CANCELLED" && parentOrder.paymentStatus === "PAID") {
        const [customerWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, parentOrder.customerId))
          .for("update");

        if (customerWallet) {
          const refundAmount = parseFloat(subOrder.subtotal);
          const deliveryFeeRefund = subOrder.expectedDeliveryFee ? parseFloat(subOrder.expectedDeliveryFee) : 0;
          const totalRefund = refundAmount + deliveryFeeRefund;
          const newBalance = (parseFloat(customerWallet.balance) + totalRefund).toFixed(2);

          await tx
            .update(wallets)
            .set({ balance: newBalance, updatedAt: new Date() })
            .where(eq(wallets.id, customerWallet.id));

          await tx.insert(walletTransactions).values({
            walletId: customerWallet.id,
            type: "REFUND",
            amount: totalRefund.toFixed(2),
            relatedOrderId: parentOrder.id,
            status: "COMPLETED",
            notes: `استرداد تلقائي - إلغاء طلب فرعي #${subOrderId.slice(0, 8)} من المتجر`,
          });

          // BUG-FIX-11: Missing ledger entry for sub-order cancellation refund.
          // Every wallet credit must have a matching ledger entry for accounting integrity.
          await tx.insert(ledger).values({
            referenceId: subOrder.orderId,
            debitUserId: null,
            creditUserId: parentOrder.customerId,
            amount: totalRefund.toFixed(2),
            type: "WITHDRAWAL",
          });

          console.log(`[SubOrderService] Refunded ${totalRefund} to customer wallet for cancelled sub-order ${subOrderId}`);
        }
      }

      await auditService.logEvent({
        actionType: "SUB_ORDER_STATUS_UPDATE",
        entityType: "sub_order",
        entityId: subOrderId,
        performedByUserId: actorUser.id,
        performedByRole: actorUser.role,
        oldValue: { status: subOrder.status },
        newValue: { status: newStatus },
        metadata: { orderId: subOrder.orderId },
      });

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
        sub_order_id: updatedSubOrder.id,
        old_status: subOrder.status,
        new_status: updatedSubOrder.status,
        updated_at: updatedSubOrder.updatedAt.toISOString(),
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
        storeName: stores.name,
        storeId: subOrders.storeId,
        customerName: users.name,
        customerPhone: users.phone,
      })
      .from(subOrders)
      .innerJoin(orders, eq(subOrders.orderId, orders.id))
      .innerJoin(users, eq(orders.customerId, users.id))
      .innerJoin(stores, eq(subOrders.storeId, stores.id))
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
