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
  private async decrementStock(tx: any, subOrderId: string, actorId: string, isOverride: boolean = false) {
    const items = await tx
      .select({
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        productName: products.name,
        currentStock: products.stock,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.subOrderId, subOrderId));

    const insufficientItems = [];
    const stockUpdates = [];

    for (const item of items) {
      if (item.quantity <= 0) {
        throw new Error("INVALID_QUANTITY");
      }

      if (!isOverride && item.currentStock < item.quantity) {
        insufficientItems.push({
          product_id: item.productId,
          product_name: item.productName,
          available: item.currentStock,
          requested: item.quantity
        });
      }
    }

    if (insufficientItems.length > 0) {
      const error: any = new Error("INSUFFICIENT_STOCK");
      error.details = insufficientItems;
      throw error;
    }

    for (const item of items) {
      const newStock = item.currentStock - item.quantity;
      await tx
        .update(products)
        .set({
          stock: newStock,
          updatedAt: new Date(),
        })
        .where(eq(products.id, item.productId));
      
      stockUpdates.push({
        product_id: item.productId,
        old_stock: item.currentStock,
        new_stock: newStock
      });

      if (isOverride && item.currentStock < item.quantity) {
        console.warn(`[AUDIT-STOCK] user=${actorId} manual override for insufficient stock on suborder=${subOrderId} product=${item.productId}`);
      }
    }

    console.log(`[AUDIT-STOCK] user=${actorId} decremented stock for suborder=${subOrderId} items=[${items.map(i => i.productId).join(",")}] override=${isOverride}`);
    
    // Emit event placeholder
    console.log(`[EVENT] suborder.stock.updated: ${JSON.stringify({
      sub_order_id: subOrderId,
      products: stockUpdates,
      actor_id: actorId,
      timestamp: new Date().toISOString()
    })}`);

    return stockUpdates;
  }

  async updateSubOrderStatus(subOrderId: string, newStatus: any, actorUser: User): Promise<any> {
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
      let stockUpdates = [];
      if (currentStatus === "PENDING" && newStatus === "ACCEPTED") {
        stockUpdates = await this.decrementStock(tx, subOrderId, actorUser.id, isOverride);
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

      return {
        sub_order_id: updatedSubOrder.id,
        status: updatedSubOrder.status,
        stock_updates: stockUpdates.map(u => ({
          product_id: u.product_id,
          previous_stock: u.old_stock,
          new_stock: u.new_stock
        })),
        updated_at: updatedSubOrder.updatedAt.toISOString()
      };
    });
  }
}

export const subOrderService = new SubOrderService();
