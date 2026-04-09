import { db } from "../../db";
import { orders, subOrders, orderItems, products, wallets, walletTransactions, stores, users, deliveryOtps, ledger } from "@shared/schema";
import { eq, and, sql, inArray, gt } from "drizzle-orm";
import { notifyUser } from "../notifications/push.service";
import { deliveryOtpService } from "../delivery/deliveryOtp.service";
import { chatService } from "../chat/chat.service";

export class OrderService {
  async createMultiStoreOrder(customerId: string, items: { productId: string, quantity: number }[]) {
    return await db.transaction(async (tx) => {
      // 1. Fetch all products in one query
      const productIds = items.map(i => i.productId);
      // BUG-FIX: Products were fetched without FOR UPDATE lock, creating a TOCTOU race
      // condition where two concurrent orders could both read the same stock value, both
      // pass the stock check, and both decrement — resulting in negative stock (overselling).
      // FOR UPDATE ensures exclusive row-level locks are held for the duration of the transaction.
      const fetchedProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds))
        .for("update");

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

      // 3. Deduct from customer wallet — SELECT FOR UPDATE to prevent race condition
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, customerId)).limit(1).for("update");
      if (!wallet) throw new Error("Customer wallet not found");
      const balance = parseFloat(wallet.balance);
      if (balance < totalPrice) throw new Error("Insufficient wallet balance");

      await tx.update(wallets)
        .set({ balance: (balance - totalPrice).toFixed(2) })
        .where(eq(wallets.id, wallet.id));

      // 4. Create parent order BEFORE recording the wallet transaction so we can
      // BUG-FIX: walletTransactions was inserted before the order existed, so relatedOrderId
      // was always NULL — making it impossible to trace any payment back to its order in
      // transaction history or audit reports. Create the order first, then reference its ID.
      const [order] = await tx.insert(orders).values({
        customerId,
        totalPrice: totalPrice.toFixed(2),
        overallStatus: "PENDING",
        paymentStatus: "PAID",
      }).returning();

      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        type: "WITHDRAWAL",
        amount: totalPrice.toFixed(2),
        relatedOrderId: order.id,
        status: "COMPLETED",
        notes: `دفع طلب #${order.id.slice(0, 8)}`,
      });

      // Missing ledger entry for order payment — every wallet debit must have
      // a matching double-entry ledger record.
      await tx.insert(ledger).values({
        referenceId: order.id,
        debitUserId: customerId,
        creditUserId: null,
        amount: totalPrice.toFixed(2),
        type: "WITHDRAWAL",
      });

      const [customer] = await tx.select().from(users).where(eq(users.id, customerId)).limit(1);

      // 5. Create sub-orders and order items per store
      const subOrdersCreated: { subOrderId: string; ownerId: string; storeName: string }[] = [];

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
          expectedDeliveryFee: "0.00",
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

        // Q: هل يجب استخدام حساب JavaScript (product.stock - quantity) أم تعبير SQL
        //    لتحديث المخزون عند إنشاء الطلب؟
        // A: تعبير SQL أصح لثلاثة أسباب:
        //    1. يُجري الحساب على مستوى DB مباشرةً بدلاً من في الذاكرة، مما يتجنب
        //       أي تفاوت محتمل بين القيمة المقروءة والقيمة المُحدَّثة.
        //    2. يتوافق مع نفس النمط المستخدم في suborder.service.ts (سطر 92) وفي
        //       routes.ts (الإلغاء الإداري)، مما يضمن اتساق الكود.
        //    3. في حال تعديل منطق FOR UPDATE مستقبلاً، SQL expression يظل آمناً
        //       بينما القيمة الحسابية في JavaScript قد تُسبب race condition.
        for (const { product, quantity } of storeItems) {
          if (product.stock !== null) {
            await tx.update(products)
              .set({ stock: sql`stock - ${quantity}` })
              .where(eq(products.id, product.id));
          }
        }

        // Notify store owner and track for chat room creation
        const [store] = await tx.select().from(stores).where(eq(stores.id, storeId)).limit(1);
        if (store) {
          const [owner] = await tx.select().from(users).where(eq(users.id, store.ownerId)).limit(1);
          if (owner) {
            subOrdersCreated.push({ subOrderId: subOrder.id, ownerId: owner.id, storeName: store.name });
          }
        }
      }

      // Q: لماذا نستخدم customerId (معامل الدالة) بدلاً من customer?.id؟
      // A: customer?.id قد يكون undefined إذا فشل استعلام DB في إيجاد المستخدم
      //    (تلف بيانات، سباق حذف، خطأ عابر). في هذه الحالة:
      //    1. chatService.createRoom يُستدعى بـ [undefined, ownerId] مما قد يُنشئ
      //       غرفة دردشة بدون عضو صالح أو يُطلق استثناءً غير متوقعاً.
      //    2. notifyUser(customerId) في الـ .then() يُرسل إشعاراً لـ undefined
      //       ويُخفق بصمت بسبب try/catch الخارجي.
      //    استخدام معامل الدالة customerId (UUID موثوق منه قبل بدء المعاملة)
      //    يضمن أن الغرف والإشعارات تعمل دائماً بصرف النظر عن نتيجة SELECT.
      //    الإصلاح: إرجاع customerId (المعامل) بدلاً من customer?.id.
      return { order, subOrdersCreated, customerId };
    }).then(async ({ order, subOrdersCreated, customerId }) => {
      // Create ORDER_STORE chat rooms after transaction commits
      for (const { subOrderId, ownerId, storeName } of subOrdersCreated) {
        try {
          await chatService.createRoom("ORDER_STORE", [customerId as string, ownerId], {
            referenceId: subOrderId,
            title: `طلب من ${storeName}`,
          });
        } catch {}

        // Notify store owner
        notifyUser(ownerId, "NEW_ORDER", "طلب جديد", `لديك طلب جديد بانتظار موافقتك`, {
          orderId: order.id,
          subOrderId,
        }).catch(console.error);
      }

      // Notify customer
      if (customerId) {
        notifyUser(customerId, "ORDER_STATUS_UPDATE", "تم استلام طلبك", "طلبك قيد المراجعة من المتجر", {
          orderId: order.id,
          status: "PENDING",
        }).catch(console.error);
      }

      return order;
    });
  }

  async getOrderWithSubOrders(orderId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) throw new Error("Order not found");

    // Fetch customer info
    const [customer] = await db
      .select({ name: users.name, email: users.email, phone: users.phone, addresses: users.addresses })
      .from(users)
      .where(eq(users.id, order.customerId))
      .limit(1);

    const subs = await db.select().from(subOrders).where(eq(subOrders.orderId, orderId));

    const subsWithItems = await Promise.all(subs.map(async (sub) => {
      const rawItems = await db.select({
        id: orderItems.id,
        subOrderId: orderItems.subOrderId,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        priceAtOrder: orderItems.priceAtOrder,
        productName: products.name,
        productImageUrl: products.imageUrl,
      })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.subOrderId, sub.id));

      const items = rawItems.map(item => ({
        ...item,
        product_name: item.productName,
        price_at_order: item.priceAtOrder,
      }));

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
          // Q: هل يُسبب توليد OTP تلقائياً داخل دالة قراءة (GET) race condition؟
          // A: نعم — إذا وصل طلبان متزامنان لنفس اللحظة وكلاهما وجد OTP منتهية الصلاحية،
          //    ينطلق كلاهما لتوليد OTP جديد بشكل مستقل:
          //    1. الطلب الأول يُولّد OTP#1 (يُبطل القديمة)
          //    2. الطلب الثاني يُولّد OTP#2 (يُبطل OTP#1 الجديدة)
          //    النتيجة: العميل يحصل على OTP#1 في شاشته لكن OTP#2 هو الصالح في DB
          //    والسائق يرفض OTP#1 → يضطر العميل لإعادة تحميل الصفحة للحصول على OTP#2.
          //    الإصلاح الجزئي: إعادة التحقق من وجود OTP صالح قبل التوليد، لتضييق
          //    نافذة التزامن. الإصلاح الكامل: عزل التوليد في endpoint مستقل مع قفل DB.
          const [recheckOtp] = await db
            .select({ otpCode: deliveryOtps.otpCode })
            .from(deliveryOtps)
            .where(and(
              eq(deliveryOtps.subOrderId, sub.id),
              eq(deliveryOtps.status, "PENDING"),
              gt(deliveryOtps.expiresAt, new Date())
            ))
            .limit(1);

          if (recheckOtp) {
            otpCode = recheckOtp.otpCode;
          } else {
            otpCode = await deliveryOtpService.generateOtp(sub.orderId, sub.id);
          }
        }
      }

      return { ...sub, sub_order_id: sub.id, store_id: sub.storeId, store: store || null, driver, otpCode, items };
    }));

    const addresses = (customer?.addresses as string[]) || [];

    // Auto-heal: if all sub-orders are done but parent order is not in a final status, fix it.
    // BUG-FIX: Was only healing when overallStatus === "PENDING". If the order was in
    // "ACCEPTED" or "IN_TRANSIT" and all sub-orders completed/cancelled, the parent order
    // would remain stuck in a non-final status forever. Now heals for any non-final status.
    const allDone = subsWithItems.every(s => s.status === "DELIVERED" || s.status === "CANCELLED");
    const anyDelivered = subsWithItems.some(s => s.status === "DELIVERED");
    let effectiveStatus = order.overallStatus;

    const isFinalStatus = order.overallStatus === "DELIVERED" || order.overallStatus === "CANCELLED";
    if (allDone && !isFinalStatus) {
      const healedStatus = anyDelivered ? "DELIVERED" : "CANCELLED";
      try {
        await db.update(orders)
          .set({ overallStatus: healedStatus, updatedAt: new Date() })
          .where(eq(orders.id, orderId));
        effectiveStatus = healedStatus;
      } catch (_) {
        // If update fails, compute the status in memory
        effectiveStatus = healedStatus;
      }
    }

    return {
      ...order,
      overallStatus: effectiveStatus,
      customerName: customer?.name || null,
      customerEmail: customer?.email || null,
      customerPhone: customer?.phone || null,
      deliveryAddress: addresses.length > 0 ? addresses[0] : null,
      subOrders: subsWithItems,
    };
  }

  async getCustomerOrders(customerId: string) {
    // Q: هل هناك مشكلة أداء في استدعاء getOrderWithSubOrders لكل طلب على حدة؟
    // A: نعم — هذا نمط N+1 كلاسيكي. getOrderWithSubOrders تُشغّل 6-8 استعلامات DB
    //    لكل طلب: (الطلب + العميل + الطلبات الفرعية + لكل طلب فرعي: العناصر + المتجر
    //    + السائق + OTP). لعميل لديه 10 طلبات، هذا يعني ~60-80 استعلاماً بدلاً من 5-6.
    //    مع Promise.all كل هذه الاستعلامات تنطلق بالتوازي محتلّةً connection pool الـ DB.
    //    الإصلاح المثالي: إعادة كتابة getCustomerOrders بجلب batch واحد لكل البيانات.
    //    الإصلاح المؤقت: الإبقاء على التطبيق الحالي مع توثيق المشكلة للمرجعية المستقبلية.
    //    ملاحظة: في الإنتاج تحتاج تطبيق هذا الإصلاح عندما يكون لدى المستخدمين > 20 طلباً.
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
    // Q: هل يجب إضافة pagination لـ getStoreOwnerOrders؟
    // A: نعم في الإنتاج — متجر نشط بعشرات الطلبات اليومية سيجمع مئات أو آلاف
    //    الطلبات بمرور الوقت، وجلبها دفعةً واحدة يُسبب مشكلتين:
    //    1. استهلاك ذاكرة كبير لكل استدعاء من صاحب المتجر.
    //    2. بطء الاستجابة يُحبط المستخدمين ويُثقل connection pool الـ DB.
    //    الإصلاح المستقبلي: إضافة limit وoffset للدالة وتحديث الـ controller والـ frontend.
    //    ملاحظة: في الوقت الحالي يُقبل هذا لأن المنصة في مراحل مبكرة وحجم البيانات صغير.
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

    // BUG-FIX: N+1 query — was fetching order items for each sub-order individually inside
    // a for loop, causing 1 + N database round-trips. Now batch-fetches all items in a
    // single query and groups them in memory before building the response.
    const subOrderIds = ownerSubOrders.map(r => r.subOrder.id);
    let allItemsMap: Record<string, { product_name: string; price: string; quantity: number }[]> = {};

    if (subOrderIds.length > 0) {
      const allItems = await db.select({
        subOrderId: orderItems.subOrderId,
        product_name: products.name,
        price: orderItems.priceAtOrder,
        quantity: orderItems.quantity,
      })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(inArray(orderItems.subOrderId, subOrderIds));

      for (const item of allItems) {
        if (!allItemsMap[item.subOrderId]) allItemsMap[item.subOrderId] = [];
        allItemsMap[item.subOrderId].push({ product_name: item.product_name, price: item.price, quantity: item.quantity });
      }
    }

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

      orderMap.get(orderId).sub_orders.push({
        sub_order_id: row.subOrder.id,
        status: row.subOrder.status,
        subtotal: row.subOrder.subtotal,
        createdAt: row.subOrder.createdAt,
        items: allItemsMap[row.subOrder.id] || [],
      });
    }

    const result = Array.from(orderMap.values());
    // Compute effective overall_status from sub-orders for display accuracy.
    // BUG-FIX: Was only healing when overall_status === "PENDING". Same bug as in
    // getOrderWithSubOrders — if the order was "ACCEPTED" or "IN_TRANSIT" and all
    // sub-orders completed, the displayed status remained stuck in a non-final state.
    // Now heals for any non-final status when all sub-orders are done.
    return result.map((ord: any) => {
      const subs = ord.sub_orders || [];
      const allDone = subs.length > 0 && subs.every((s: any) => s.status === "DELIVERED" || s.status === "CANCELLED");
      const anyDelivered = subs.some((s: any) => s.status === "DELIVERED");
      const hasInTransit = subs.some((s: any) => s.status === "IN_TRANSIT");
      const hasAccepted = subs.some((s: any) => s.status === "ACCEPTED");

      const isFinalStatus = ord.overall_status === "DELIVERED" || ord.overall_status === "CANCELLED";
      let effectiveStatus = ord.overall_status;
      if (allDone && !isFinalStatus) {
        effectiveStatus = anyDelivered ? "DELIVERED" : "CANCELLED";
      } else if (!allDone && hasInTransit) {
        effectiveStatus = "IN_TRANSIT";
      } else if (!allDone && hasAccepted) {
        effectiveStatus = "ACCEPTED";
      }
      return { ...ord, overall_status: effectiveStatus };
    });
  }

  async cancelSubOrder(subOrderId: string, userId: string) {
    return await db.transaction(async (tx) => {
      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, subOrderId)).for("update");
      if (!subOrder) throw new Error("SubOrder not found");

      const [order] = await tx.select().from(orders).where(eq(orders.id, subOrder.orderId));
      if (order.customerId !== userId) throw new Error("Unauthorized");
      if (subOrder.status === "DELIVERED") throw new Error("Cannot cancel delivered sub-order");
      if (subOrder.status === "CANCELLED") throw new Error("Sub-order already cancelled");
      // BUG-FIX: Was missing a guard for IN_TRANSIT status. The state machine
      // (allowedTransitions) only allows IN_TRANSIT → DELIVERED, never → CANCELLED.
      // Without this check, a customer could cancel a sub-order while the driver is
      // already on the way, receive a full refund, and leave the driver uncompensated.
      if (subOrder.status === "IN_TRANSIT") throw new Error("Cannot cancel sub-order that is already in transit");

      await tx.update(subOrders).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(subOrders.id, subOrderId));

      // BUG-FIX: Stock was never replenished on sub-order cancellation, causing permanent
      // inventory leakage — cancelled items remained deducted from the store's stock levels
      // indefinitely. Fetch all items for this sub-order and increment each product's stock.
      const cancelledItems = await tx
        .select({ productId: orderItems.productId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.subOrderId, subOrderId));

      for (const item of cancelledItems) {
        await tx.update(products)
          .set({ stock: sql`stock + ${item.quantity}` })
          .where(eq(products.id, item.productId));
      }

      if (order.paymentStatus === "PAID") {
        const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).for("update");

        // BUG-FIX: Was using `if (wallet)` which silently skips the entire refund when the
        // wallet row is missing. The order payment already left the customer's wallet, so a
        // missing wallet here means the money vanishes. Throw to roll back the whole tx instead.
        if (!wallet) throw new Error("WALLET_NOT_FOUND: Cannot refund cancelled sub-order — customer wallet missing");

        const subtotalRefund = parseFloat(subOrder.subtotal);
        const deliveryFeeRefund = subOrder.expectedDeliveryFee ? parseFloat(subOrder.expectedDeliveryFee) : 0;
        const totalRefund = subtotalRefund + deliveryFeeRefund;

        await tx.update(wallets)
          .set({ balance: (parseFloat(wallet.balance) + totalRefund).toFixed(2), updatedAt: new Date() })
          .where(eq(wallets.id, wallet.id));

        await tx.insert(walletTransactions).values({
          walletId: wallet.id,
          type: "REFUND",
          amount: totalRefund.toFixed(2),
          relatedOrderId: order.id,
          status: "COMPLETED",
          notes: `استرداد عند إلغاء الطلب الفرعي #${subOrderId.slice(0, 8)}`,
        });

        // BUG-FIX: Was type "WITHDRAWAL" for a credit to the customer (refund).
        // BUG-FIX-2: Was type "DEPOSIT" which is semantically wrong — a refund is a
        // distinct financial event. Now uses "REFUND" for accurate audit trail reporting.
        await tx.insert(ledger).values({
          referenceId: order.id,
          debitUserId: null,
          creditUserId: userId,
          amount: totalRefund.toFixed(2),
          type: "REFUND",
        });
      }
    });
  }
}

export const orderService = new OrderService();
