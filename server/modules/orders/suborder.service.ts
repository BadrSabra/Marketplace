import { db } from "../../db";
import { subOrders, stores, orderItems, products, deliveryOffers } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { User, SubOrder } from "@shared/schema";
import { auditService } from "../../services/auditService";
import { allowedTransitions } from "./suborder.types";

export class SubOrderService {
  /**
   * Internal helper to decrement stock when a sub-order is accepted.
   * Validates that all items have sufficient stock before proceeding.
   */
  private async decrementStock(tx: any, subOrderId: string, isOverride: boolean = false) {
    const items = await tx
      .select({
        itemId: orderItems.id,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        productName: products.name,
        currentStock: products.stock,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.subOrderId, subOrderId));

    for (const item of items) {
      if (!isOverride && item.currentStock < item.quantity) {
        console.log(`[AUDIT] Stock decrement failed for sub-order ${subOrderId}: Product ${item.productName} has insufficient stock`);
        throw new Error(`INSUFFICIENT_STOCK: ${item.productName}`);
      }

      await tx
        .update(products)
        .set({
          stock: item.currentStock - item.quantity,
          updatedAt: new Date(),
        })
        .where(eq(products.id, item.productId));
      
      console.log(`[AUDIT] Stock decremented for product ${item.productName} (Qty: ${item.quantity})`);
    }
  }

  async updateSubOrderStatus(subOrderId: string, newStatus: any, actorUser: User): Promise<SubOrder> {
    return await db.transaction(async (tx) => {
      // Use SELECT FOR UPDATE to prevent race conditions
      const [subOrder] = await tx
        .select()
        .from(subOrders)
        .where(eq(subOrders.id, subOrderId))
        .for("update");

      if (!subOrder) throw new Error("NOT_FOUND");

      const currentStatus = subOrder.status as keyof typeof allowedTransitions;

      // 1. Transition validation
      if (!allowedTransitions[currentStatus]?.includes(newStatus) && newStatus !== "CANCELLED") {
        throw new Error("INVALID_TRANSITION");
      }

      // 2. RBAC Validation
      let isOverride = false;
      if (actorUser.role === "STORE_OWNER") {
        const [store] = await tx
          .select()
          .from(stores)
          .where(and(eq(stores.id, subOrder.storeId), eq(stores.ownerId, actorUser.id)));
        
        if (!store) throw new Error("UNAUTHORIZED_OWNERSHIP");

        const storeAllowed = ["ACCEPTED", "READY", "CANCELLED"];
        if (!storeAllowed.includes(newStatus)) throw new Error("UNAUTHORIZED_ACTION");
      } else if (actorUser.role === "DRIVER") {
        const [assignedOffer] = await tx
          .select()
          .from(deliveryOffers)
          .where(and(
            eq(deliveryOffers.subOrderId, subOrderId),
            eq(deliveryOffers.driverId, actorUser.id),
            eq(deliveryOffers.status, "ACCEPTED")
          ));
        
        if (!assignedOffer && actorUser.role !== "ADMIN") throw new Error("UNAUTHORIZED_ACTION");

        const driverAllowed = ["PICKED_UP", "DELIVERED"];
        if (!driverAllowed.includes(newStatus)) throw new Error("UNAUTHORIZED_ACTION");
      } else if (actorUser.role === "ADMIN") {
        isOverride = true;
      } else {
        throw new Error("UNAUTHORIZED_ROLE");
      }

      // 3. Stock Management
      if (currentStatus === "PENDING" && newStatus === "ACCEPTED") {
        await this.decrementStock(tx, subOrderId, isOverride);
      }

      // 4. Update status
      const [updatedSubOrder] = await tx
        .update(subOrders)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(subOrders.id, subOrderId))
        .returning();

      // 5. Audit & Logging
      console.log(`[AUDIT-PLACEHOLDER] user=${actorUser.id} changed suborder=${subOrderId} from ${currentStatus} to ${newStatus}`);
      
      await auditService.logEvent({
        actionType: "ORDER_STATUS_CHANGE",
        entityType: "suborder",
        entityId: subOrderId,
        performedByUserId: actorUser.id,
        performedByRole: actorUser.role,
        oldValue: { status: currentStatus },
        newValue: { status: newStatus },
        metadata: { timestamp: new Date().toISOString() }
      });

      return updatedSubOrder;
    });
  }
}

export const subOrderService = new SubOrderService();


export const subOrderService = new SubOrderService();
