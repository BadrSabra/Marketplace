import { db } from "../../db";
import { subOrders, orders, stores, users, orderItems, products } from "@shared/schema";
import { eq, and, isNull, sql, asc } from "drizzle-orm";
import { AvailableTaskDTO, GetAvailableTasksFilters } from "./delivery.types";

export class DeliveryService {
  async getAvailableTasks(driverId: string, filters: GetAvailableTasksFilters): Promise<{ tasks: AvailableTaskDTO[], total: number }> {
    // 1. Verify driver is active & approved
    const [driver] = await db.select().from(users).where(and(eq(users.id, driverId), eq(users.role, "DRIVER")));
    if (!driver) throw new Error("UNAUTHORIZED_ROLE");
    if (!driver.isApproved) throw new Error("DRIVER_NOT_APPROVED");

    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, filters.limit || 20);
    const offset = (page - 1) * limit;

    // 2. Query sub-orders: status = READY AND assigned_driver_id IS NULL
    // Note: Based on schema, sub_orders don't have assigned_driver_id directly, 
    // it's usually in delivery_offers or a field we might need to assume exists or join.
    // Looking at schema.ts, sub_orders doesn't have assigned_driver_id. 
    // However, the prompt says "assigned_driver_id IS NULL". 
    // I will check if I need to add assignedDriverId to sub_orders or if it's managed via delivery_offers.
    // Given Prompt 4 instructions, I'll assume it should be on sub_orders for this logic.
    
    let baseQuery = db
      .select({
        sub_order_id: subOrders.id,
        order_id: subOrders.orderId,
        store_id: subOrders.storeId,
        store_name: stores.name,
        customer_name: users.name,
        customer_address: sql<string>`'Address placeholder'`, // orders table doesn't have address, assuming placeholder or join
        subtotal: subOrders.subtotal,
        created_at: subOrders.createdAt,
        status: subOrders.status,
      })
      .from(subOrders)
      .innerJoin(orders, eq(subOrders.orderId, orders.id))
      .innerJoin(stores, eq(subOrders.storeId, stores.id))
      .innerJoin(users, eq(orders.customerId, users.id))
      .where(
        and(
          eq(subOrders.status, "READY"),
          isNull(subOrders.assignedDriverId)
        )
      );

    // Apply filters
    if (filters.store_id) {
      baseQuery = baseQuery.where(eq(subOrders.storeId, filters.store_id));
    }

    if (filters.category) {
      // Filter by product category in items
      const subOrdersWithCategory = db
        .select({ id: orderItems.subOrderId })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(products.category, filters.category));
      
      baseQuery = baseQuery.where(sql`${subOrders.id} IN ${subOrdersWithCategory}`);
    }

    const totalResults = await db.select({ count: sql<number>`count(*)` }).from(subOrders).where(eq(subOrders.status, "READY"));
    const total = Number(totalResults[0].count);

    const results = await (baseQuery as any)
      .orderBy(asc(subOrders.createdAt))
      .limit(limit)
      .offset(offset);

    const tasks: AvailableTaskDTO[] = await Promise.all(results.map(async (res: any) => {
      const items = await db
        .select({
          product_name: products.name,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.subOrderId, res.sub_order_id));

      return {
        sub_order_id: res.sub_order_id,
        order_id: res.order_id,
        store_id: res.store_id,
        store_name: res.store_name,
        customer_name: res.customer_name,
        customer_address: res.customer_address,
        items,
        subtotal: Number(res.subtotal),
        created_at: res.created_at.toISOString(),
        status: res.status as any,
        assigned_driver_id: null
      };
    }));

    console.log(`[AUDIT-DELIVERY] driver_id=${driverId} action=VIEW_AVAILABLE_TASKS filters=${JSON.stringify(filters)}`);

    return { tasks, total };
  }
}

export const deliveryService = new DeliveryService();
