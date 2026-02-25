import { db } from "../../db";
import { subOrders, stores } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { User, SubOrder } from "@shared/schema";

export class SubOrderService {
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
      } else {
        throw new Error("UNAUTHORIZED_ROLE");
      }

      // 3. Update status
      const [updatedSubOrder] = await tx
        .update(subOrders)
        .set({ 
          status: newStatus as any,
          updatedAt: new Date()
        })
        .where(eq(subOrders.id, subOrderId))
        .returning();

      // TODO: Add audit log entry

      return updatedSubOrder;
    });
  }
}

export const subOrderService = new SubOrderService();
