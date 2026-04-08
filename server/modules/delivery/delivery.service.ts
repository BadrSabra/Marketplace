import { db } from "../../db";
import { subOrders, orders, stores, users, orderItems, products, deliveryOffers } from "@shared/schema";
import { eq, and, isNull, sql, asc, inArray, SQL } from "drizzle-orm";
import { AvailableTaskDTO, GetAvailableTasksFilters } from "./delivery.types";
import { auditService } from "../../services/auditService";

export class DeliveryService {
  async getAvailableTasks(driverId: string, filters: GetAvailableTasksFilters): Promise<{ tasks: AvailableTaskDTO[], total: number }> {
    // 1. Verify driver is active & approved
    const [driver] = await db.select().from(users).where(and(eq(users.id, driverId), eq(users.role, "DRIVER")));
    if (!driver) throw new Error("UNAUTHORIZED_ROLE");
    if (!driver.isApproved) throw new Error("DRIVER_NOT_APPROVED");

    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, filters.limit || 20);
    const offset = (page - 1) * limit;

    // BUG-FIX-4: Build all filter conditions upfront then apply once.
    // Previously each `.where()` call replaced the previous one, losing the base
    // ACCEPTED + unassigned conditions whenever store_id or category was provided.
    const baseConditions: SQL[] = [
      eq(subOrders.status, "ACCEPTED"),
      isNull(subOrders.assignedDriverId),
    ];

    if (filters.store_id) {
      baseConditions.push(eq(subOrders.storeId, filters.store_id));
    }

    if (filters.category) {
      const subOrdersWithCategory = db
        .select({ id: orderItems.subOrderId })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(products.category, filters.category));

      baseConditions.push(sql`${subOrders.id} IN ${subOrdersWithCategory}`);
    }

    const combinedWhere = and(...baseConditions);

    // BUG-FIX-6: Count query now uses the same combined conditions as the data query
    // so the total accurately reflects the filtered result set
    const totalResults = await db
      .select({ count: sql<number>`count(*)` })
      .from(subOrders)
      .innerJoin(stores, eq(subOrders.storeId, stores.id))
      .where(combinedWhere);
    const total = Number(totalResults[0].count);

    const results = await db
      .select({
        sub_order_id: subOrders.id,
        order_id: subOrders.orderId,
        store_id: subOrders.storeId,
        store_name: stores.name,
        customer_name: users.name,
        customer_address: sql<string>`COALESCE((${users.addresses}->>0), 'لا يوجد عنوان محدد')`,
        subtotal: subOrders.subtotal,
        created_at: subOrders.createdAt,
        status: subOrders.status,
        assigned_driver_id: subOrders.assignedDriverId,
      })
      .from(subOrders)
      .innerJoin(orders, eq(subOrders.orderId, orders.id))
      .innerJoin(stores, eq(subOrders.storeId, stores.id))
      .innerJoin(users, eq(orders.customerId, users.id))
      .where(combinedWhere)
      .orderBy(asc(subOrders.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch driver's existing offers for these sub-orders
    const subOrderIds = results.map((r: any) => r.sub_order_id);
    let driverOffersMap: Record<string, { status: string; offeredFee: string; counterOfferedFee: string | null }> = {};

    if (subOrderIds.length > 0) {
      const driverExistingOffers = await db
        .select({
          subOrderId: deliveryOffers.subOrderId,
          status: deliveryOffers.status,
          offeredFee: deliveryOffers.offeredFee,
          counterOfferedFee: deliveryOffers.counterOfferedFee,
        })
        .from(deliveryOffers)
        .where(
          and(
            eq(deliveryOffers.driverId, driverId),
            inArray(deliveryOffers.subOrderId, subOrderIds)
          )
        );

      for (const o of driverExistingOffers) {
        driverOffersMap[o.subOrderId] = {
          status: o.status,
          offeredFee: o.offeredFee,
          counterOfferedFee: o.counterOfferedFee,
        };
      }
    }

    const tasks: AvailableTaskDTO[] = await Promise.all(results.map(async (res: any) => {
      const items = await db
        .select({
          product_name: products.name,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.subOrderId, res.sub_order_id));

      const existingOffer = driverOffersMap[res.sub_order_id] || null;

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
        assigned_driver_id: res.assigned_driver_id,
        driver_offer_status: existingOffer?.status ?? null,
        driver_offered_fee: existingOffer?.offeredFee ?? null,
        driver_counter_offered_fee: existingOffer?.counterOfferedFee ?? null,
      };
    }));

    await auditService.logEvent({
      actionType: "VIEW_AVAILABLE_TASKS",
      entityType: "DELIVERY_TASK",
      entityId: driverId,
      performedByUserId: driverId,
      performedByRole: "DRIVER",
      metadata: { filters, totalResults: total },
    });

    return { tasks, total };
  }
}

export const deliveryService = new DeliveryService();
