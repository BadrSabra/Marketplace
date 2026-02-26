import { db } from "../../db";
import { subOrders, stores, orderItems, products } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { User, SubOrder } from "@shared/schema";
import { auditService } from "../../services/auditService";

export class SubOrderService {
  /**
   * Internal helper to decrement stock when a sub-order is accepted.
   * Validates that all items have sufficient stock before proceeding.
   * @param tx Drizzle transaction instance
   * @param subOrderId ID of the sub-order being accepted
   * @param isOverride If true (e.g., ADMIN), skip stock validation checks
   */
  private async decrementStock(tx: any, subOrderId: string, isOverride: boolean = false) {
    // Fetch all items in the sub-order with their current product stock
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
        // Log failure for audit preparation
        console.log(`[AUDIT] Stock decrement failed for sub-order ${subOrderId}: Product ${item.productName} has insufficient stock (${item.currentStock} < ${item.quantity})`);
        throw new Error(`INSUFFICIENT_STOCK: ${item.productName}`);
      }

      // Deduct quantity from products.stock
      await tx
        .update(products)
        .set({
          stock: item.currentStock - item.quantity,
          updatedAt: new Date(),
        })
        .where(eq(products.id, item.productId));
      
      console.log(`[AUDIT] Stock decremented for product ${item.productName} (Qty: ${item.quantity}) in sub-order ${subOrderId}`);
    }
  }

  async updateSubOrderStatus(subOrderId: string, newStatus: string, actorUser: User): Promise<SubOrder> {
    return await db.transaction(async (tx) => {
      // 1. Fetch sub-order
      const [subOrder] = await tx
        .select()
        .from(subOrders)
        .where(eq(subOrders.id, subOrderId));

      if (!subOrder) {
        throw new Error("NOT_FOUND");
      }

      // 2. Validate ownership/role and transition
      const currentStatus = subOrder.status;

      // Transition validation logic
      const allowedTransitions: Record<string, string[]> = {
        "PENDING": ["ACCEPTED", "CANCELLED"],
        "ACCEPTED": ["READY", "CANCELLED"],
        "READY": ["PICKED_UP", "CANCELLED"],
        "PICKED_UP": ["DELIVERED", "CANCELLED"],
      };

      if (!allowedTransitions[currentStatus]?.includes(newStatus) && newStatus !== "CANCELLED") {
        throw new Error("INVALID_TRANSITION");
      }

      // RBAC Validation
      let isOverride = false;
      if (actorUser.role === "STORE_OWNER") {
        // Verify store ownership
        const [store] = await tx
          .select()
          .from(stores)
          .where(and(eq(stores.id, subOrder.storeId), eq(stores.ownerId, actorUser.id)));
        
        if (!store) {
          throw new Error("UNAUTHORIZED_OWNERSHIP");
        }

        const storeAllowed = ["ACCEPTED", "READY", "CANCELLED"];
        if (!storeAllowed.includes(newStatus)) {
          throw new Error("UNAUTHORIZED_ACTION");
        }
      } else if (actorUser.role === "DRIVER") {
        if (newStatus !== "PICKED_UP") {
          throw new Error("UNAUTHORIZED_ACTION");
        }
      } else if (actorUser.role === "ADMIN") {
        // Admin can do any valid transition or cancel
        isOverride = true; // Optional emergency override for stock if needed
      } else {
        throw new Error("UNAUTHORIZED_ROLE");
      }

      // 3. Inventory Management: Handle stock decrement on ACCEPTED transition
      if (currentStatus === "PENDING" && newStatus === "ACCEPTED") {
        await this.decrementStock(tx, subOrderId, isOverride);
      }

      // 4. Update status
      const [updatedSubOrder] = await tx
        .update(subOrders)
        .set({ 
          status: newStatus as any,
          updatedAt: new Date()
        })
        .where(eq(subOrders.id, subOrderId))
        .returning();

      // Audit Log entry
      await auditService.logEvent({
        actionType: "ORDER_STATUS_CHANGE",
        entityType: "suborder",
        entityId: subOrderId,
        performedByUserId: actorUser.id,
        performedByRole: actorUser.role,
        oldValue: { status: currentStatus },
        newValue: { status: newStatus }
      });

      console.log(`[AUDIT] Sub-order ${subOrderId} status updated to ${newStatus} by ${actorUser.role} (${actorUser.id})`);

      return updatedSubOrder;
    });
  }
}

export const subOrderService = new SubOrderService();
