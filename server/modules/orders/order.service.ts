import { db } from "../../db";
import { orders, subOrders, orderItems, products, wallets, walletTransactions, stores, users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { emitNotification } from "../notifications/notification.emitter";

export class OrderService {
  async createMultiStoreOrder(customerId: string, items: { productId: string, quantity: number }[]) {
    return await db.transaction(async (tx) => {
      // ... (existing code)
      const [order] = await tx.insert(orders).values({
        customerId,
        totalPrice: totalPrice.toFixed(2),
        overallStatus: "PENDING",
        paymentStatus: "PENDING"
      }).returning();

      const [customer] = await tx.select().from(users).where(eq(users.id, customerId)).limit(1);

      // 3. Create sub-orders and items
      for (const [storeId, storeItems] of Object.entries(storeGroups)) {
        // ... (existing code)
        const [subOrder] = await tx.insert(subOrders).values({
          orderId: order.id,
          storeId,
          subtotal: subtotal.toFixed(2),
          status: "PENDING",
          expectedDeliveryFee: "10.00" // Placeholder base fee
        }).returning();

        const [store] = await tx.select().from(stores).where(eq(stores.id, storeId)).limit(1);
        if (store) {
          const [owner] = await tx.select().from(users).where(eq(users.id, store.ownerId)).limit(1);
          if (owner) {
            emitNotification("ORDER_STATUS_UPDATE", owner.id, owner.role, {
              orderId: order.id,
              subOrderId: subOrder.id,
              status: "PENDING"
            });
          }
        }
        // ... (existing code)
      }

      if (customer) {
        emitNotification("ORDER_STATUS_UPDATE", customer.id, customer.role, {
          orderId: order.id,
          status: "PENDING"
        });
      }

      return order;
    });
  }

  async getOrderWithSubOrders(orderId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) throw new Error("Order not found");

    const subs = await db.select().from(subOrders).where(eq(subOrders.orderId, orderId));
    
    const subsWithItems = await Promise.all(subs.map(async (sub) => {
      const items = await db.select({
        id: orderItems.id,
        subOrderId: orderItems.subOrderId,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        priceAtOrder: orderItems.priceAtOrder,
        product: products
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.subOrderId, sub.id));
      return { ...sub, items };
    }));

    return { ...order, subOrders: subsWithItems };
  }

  async getCustomerOrders(customerId: string) {
    const customerOrders = await db.select().from(orders).where(eq(orders.customerId, customerId));
    
    return await Promise.all(customerOrders.map(async (order) => {
      return await this.getOrderWithSubOrders(order.id);
    }));
  }

  async getStoreOwnerOrders(ownerId: string) {
    // 1. Get all stores owned by this user
    const ownerStores = await db.select().from(stores).where(eq(stores.ownerId, ownerId));
    if (ownerStores.length === 0) return [];

    const storeIds = ownerStores.map(s => s.id);

    // 2. Get all sub-orders for these stores
    const ownerSubOrders = await db.select({
      subOrder: subOrders,
      parentOrder: orders,
      customer: users,
    })
    .from(subOrders)
    .innerJoin(orders, eq(subOrders.orderId, orders.id))
    .innerJoin(users, eq(orders.customerId, users.id))
    .where(sql`${subOrders.storeId} IN ${storeIds}`);

    // 3. Group sub-orders by parent order for the requested format
    const orderMap = new Map();

    for (const row of ownerSubOrders) {
      const orderId = row.parentOrder.id;
      if (!orderMap.has(orderId)) {
        orderMap.set(orderId, {
          order_id: orderId,
          customer_name: row.customer.name,
          overall_status: row.parentOrder.overallStatus,
          sub_orders: []
        });
      }

      // Get items for this sub-order
      const items = await db.select({
        product_name: products.name,
        price: orderItems.priceAtOrder,
        quantity: orderItems.quantity
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.subOrderId, row.subOrder.id));

      orderMap.get(orderId).sub_orders.push({
        sub_order_id: row.subOrder.id,
        status: row.subOrder.status,
        subtotal: row.subOrder.subtotal,
        items
      });
    }

    return Array.from(orderMap.values());
  }

  async cancelSubOrder(subOrderId: string, userId: string) {
    return await db.transaction(async (tx) => {
      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, subOrderId));
      if (!subOrder) throw new Error("SubOrder not found");

      const [order] = await tx.select().from(orders).where(eq(orders.id, subOrder.orderId));
      if (order.customerId !== userId) throw new Error("Unauthorized");
      if (subOrder.status === "DELIVERED") throw new Error("Cannot cancel delivered sub-order");

      await tx.update(subOrders).set({ status: "CANCELLED" }).where(eq(subOrders.id, subOrderId));

      // Refund logic if paid
      if (order.paymentStatus === "PAID") {
        const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId));
        if (wallet) {
          await tx.update(wallets)
            .set({ balance: (parseFloat(wallet.balance) + parseFloat(subOrder.subtotal)).toFixed(2) })
            .where(eq(wallets.id, wallet.id));
          
          await tx.insert(walletTransactions).values({
            walletId: wallet.id,
            type: "REFUND",
            amount: subOrder.subtotal,
            relatedOrderId: order.id,
            status: "COMPLETED"
          });
        }
      }
    });
  }
}

export const orderService = new OrderService();
