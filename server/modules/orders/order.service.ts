import { db } from "../../db";
import { orders, subOrders, orderItems, products, wallets, walletTransactions, stores, users, deliveryOtps } from "@shared/schema";
import { eq, and, sql, inArray, gt } from "drizzle-orm";
import { emitNotification } from "../notifications/notification.emitter";
import { deliveryOtpService } from "../delivery/deliveryOtp.service";

export class OrderService {
  async createMultiStoreOrder(customerId: string, items: { productId: string, quantity: number }[]) {
    return await db.transaction(async (tx) => {
      // 1. Fetch all products in one query
      const productIds = items.map(i => i.productId);
      const fetchedProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds));

      if (fetchedProducts.length !== productIds.length) {
        throw new Error("One or more products not found");
      }

      // 2. Group items by storeId and calculate prices
      const storeGroups: Record<string, { product: typeof fetchedProducts[0]; quantity: number }[]> = {};
      let totalPrice = 0;

      for (const item of items) {
        const product = fetchedProducts.find(p => p.id === item.productId);
        if (!product) throw new Error(`Product ${item.productId} not found`);
        if (product.stock !== null && product.stock < item.quantity) {
          throw new Error(`Not enough stock for product: ${product.name}`);
        }
        const storeId = product.storeId;
        if (!storeGroups[storeId]) storeGroups[storeId] = [];
        storeGroups[storeId].push({ product, quantity: item.quantity });
        totalPrice += parseFloat(product.price) * item.quantity;
      }

      // 3. Deduct from customer wallet
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, customerId)).limit(1);
      if (!wallet) throw new Error("Customer wallet not found");
      const balance = parseFloat(wallet.balance);
      if (balance < totalPrice) throw new Error("Insufficient wallet balance");

      await tx.update(wallets)
        .set({ balance: (balance - totalPrice).toFixed(2) })
        .where(eq(wallets.id, wallet.id));

      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        type: "WITHDRAWAL",
        amount: totalPrice.toFixed(2),
        status: "COMPLETED",
      });

      // 4. Create parent order
      const [order] = await tx.insert(orders).values({
        customerId,
        totalPrice: totalPrice.toFixed(2),
        overallStatus: "PENDING",
        paymentStatus: "PAID",
      }).returning();

      const [customer] = await tx.select().from(users).where(eq(users.id, customerId)).limit(1);

      // 5. Create sub-orders and order items per store
      for (const [storeId, storeItems] of Object.entries(storeGroups)) {
        const subtotal = storeItems.reduce(
          (sum, { product, quantity }) => sum + parseFloat(product.price) * quantity,
          0
        );

        const [subOrder] = await tx.insert(subOrders).values({
          orderId: order.id,
          storeId,
          subtotal: subtotal.toFixed(2),
          status: "PENDING",
          expectedDeliveryFee: "10.00",
        }).returning();

        // Insert order items for this sub-order
        await tx.insert(orderItems).values(
          storeItems.map(({ product, quantity }) => ({
            subOrderId: subOrder.id,
            productId: product.id,
            quantity,
            priceAtOrder: product.price,
          }))
        );

        // Deduct stock for each product
        for (const { product, quantity } of storeItems) {
          if (product.stock !== null) {
            await tx.update(products)
              .set({ stock: product.stock - quantity })
              .where(eq(products.id, product.id));
          }
        }

        // Notify store owner
        const [store] = await tx.select().from(stores).where(eq(stores.id, storeId)).limit(1);
        if (store) {
          const [owner] = await tx.select().from(users).where(eq(users.id, store.ownerId)).limit(1);
          if (owner) {
            emitNotification("ORDER_STATUS_UPDATE", owner.id, owner.role, {
              orderId: order.id,
              subOrderId: subOrder.id,
              status: "PENDING",
            });
          }
        }
      }

      // 6. Notify customer
      if (customer) {
        emitNotification("ORDER_STATUS_UPDATE", customer.id, customer.role, {
          orderId: order.id,
          status: "PENDING",
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
        product: products,
      })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.subOrderId, sub.id));

      const [store] = await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.id, sub.storeId)).limit(1);

      let driver = null;
      if (sub.assignedDriverId) {
        const [driverUser] = await db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(eq(users.id, sub.assignedDriverId)).limit(1);
        driver = driverUser || null;
      }

      let otpCode = null;
      if (sub.status === "IN_TRANSIT") {
        const now = new Date();
        // Try to find a valid (non-expired, pending) OTP first
        const [validOtp] = await db
          .select({ otpCode: deliveryOtps.otpCode })
          .from(deliveryOtps)
          .where(and(
            eq(deliveryOtps.subOrderId, sub.id),
            eq(deliveryOtps.status, "PENDING"),
            gt(deliveryOtps.expiresAt, now)
          ))
          .limit(1);

        if (validOtp) {
          otpCode = validOtp.otpCode;
        } else {
          // OTP is expired or missing — auto-regenerate a fresh one
          otpCode = await deliveryOtpService.generateOtp(sub.orderId, sub.id);
        }
      }

      return { ...sub, store: store || null, driver, otpCode, items };
    }));

    return { ...order, subOrders: subsWithItems };
  }

  async getCustomerOrders(customerId: string) {
    const customerOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(sql`${orders.createdAt} DESC`);

    return await Promise.all(customerOrders.map(async (order) => {
      return await this.getOrderWithSubOrders(order.id);
    }));
  }

  async getStoreOwnerOrders(ownerId: string) {
    const ownerStores = await db.select().from(stores).where(eq(stores.ownerId, ownerId));
    if (ownerStores.length === 0) return [];

    const storeIds = ownerStores.map(s => s.id);

    const ownerSubOrders = await db.select({
      subOrder: subOrders,
      parentOrder: orders,
      customer: users,
    })
      .from(subOrders)
      .innerJoin(orders, eq(subOrders.orderId, orders.id))
      .innerJoin(users, eq(orders.customerId, users.id))
      .where(inArray(subOrders.storeId, storeIds));

    const orderMap = new Map();

    for (const row of ownerSubOrders) {
      const orderId = row.parentOrder.id;
      if (!orderMap.has(orderId)) {
        orderMap.set(orderId, {
          order_id: orderId,
          customer_name: row.customer.name,
          overall_status: row.parentOrder.overallStatus,
          sub_orders: [],
        });
      }

      const items = await db.select({
        product_name: products.name,
        price: orderItems.priceAtOrder,
        quantity: orderItems.quantity,
      })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.subOrderId, row.subOrder.id));

      orderMap.get(orderId).sub_orders.push({
        sub_order_id: row.subOrder.id,
        status: row.subOrder.status,
        subtotal: row.subOrder.subtotal,
        createdAt: row.subOrder.createdAt,
        items,
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
            status: "COMPLETED",
          });
        }
      }
    });
  }
}

export const orderService = new OrderService();
