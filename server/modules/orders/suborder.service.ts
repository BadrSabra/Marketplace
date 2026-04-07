import { db } from "../../db";
import { subOrders, stores, orderItems, products, deliveryOffers, users, orders, deliveryOtps } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { User, SubOrder } from "@shared/schema";
import { auditService } from "../../services/auditService";
import { allowedTransitions } from "./suborder.types";
import { emitNotification } from "../notifications/notification.emitter";

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
    return await db.transaction(async (tx) => {
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

      // 5. Audit & Logging
      // ... (existing code)

      // 6. Notifications
      if (customer) {
        emitNotification("ORDER_STATUS_UPDATE", customer.id, customer.role, {
          subOrderId,
          newStatus,
          timestamp: new Date()
        });
      }

      return {
        // ... (existing code)
      };
    });
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
          sql`${subOrders.status} IN ('ASSIGNED', 'PICKED_UP')`
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
      .where(
        and(
          eq(deliveryOtps.subOrderId, activeSubOrder.id),
          eq(deliveryOtps.status, "PENDING")
        )
      )
      .limit(1);

    return {
      ...activeSubOrder,
      items,
      otp: otpRecord?.otpCode,
    };
  }
}

export const subOrderService = new SubOrderService();
