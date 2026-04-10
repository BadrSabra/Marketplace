import { db } from "../../db";
import { subOrders, orders, stores, users, orderItems, products, deliveryOffers } from "@shared/schema";
import { eq, and, isNull, sql, asc, inArray, SQL } from "drizzle-orm";
import { AvailableTaskDTO, GetAvailableTasksFilters, OrderLevelTask } from "./delivery.types";

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
    //
    // Q: هل من الممكن أن يظهر طلب فرعي مُسلَّم (DELIVERED أو IN_TRANSIT) في هذه القائمة؟
    // A: لا — الفلتران التاليان يمنعان ذلك بشكل صارم على مستوى قاعدة البيانات:
    //    1. eq(subOrders.status, "ACCEPTED")  → يستثني DELIVERED, IN_TRANSIT, PENDING, CANCELLED
    //    2. isNull(subOrders.assignedDriverId) → يستثني أي طلب سُنِد له سائق بالفعل
    //    الطلب الفرعي يتحول من ACCEPTED → IN_TRANSIT فقط عند قبول العرض وتسنيد السائق،
    //    وكلا التحولين (status + assignedDriverId) يحدثان في نفس transaction واحدة.
    //
    //    ⚠️ نقطة الفشل الوحيدة كانت في الـ frontend cache:
    //    بعد التحقق من OTP، كان active-delivery.tsx يُبطل ["/api/suborders/active"] فقط
    //    ويترك ["/api/delivery/available-tasks"] قديماً في الذاكرة حتى دورة refetch التالية
    //    (30 ثانية). في طلب متعدد المتاجر، كان الطلب الفرعي B الشقيق (ACCEPTED+غير مُسنَد)
    //    يظهر فجأة في القائمة عند التحديث التلقائي، مما أوحى بأن "نفس الطلب يظهر مجدداً".
    //    الإصلاح: استبدال المتيشن المحلي في active-delivery.tsx بـ useVerifyOtp()
    //    الذي يُبطل كلا المفتاحين فوراً عند نجاح التحقق.
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

    // Q: هل يجب إرجاع الاسم الكامل للعميل لجميع السائقين في قائمة المهام المتاحة؟
    // A: لا — في هذه المرحلة لم يُسنَد السائق بعد إلى الطلب؛ أي سائق يرى قائمة
    //    المهام المتاحة يحصل على أسماء عملاء ليسوا عملاءه. هذا تسرّب للخصوصية.
    //    الإصلاح: استخدام أول حرف فقط من الاسم مع نقاط (مثل "م.أ") حتى يُسنَد
    //    السائق فعلياً، ومن ثَمّ يظهر له الاسم الكامل في صفحة التوصيل النشطة.
    const results = await db
      .select({
        sub_order_id: subOrders.id,
        order_id: subOrders.orderId,
        store_id: subOrders.storeId,
        store_name: stores.name,
        customer_name: sql<string>`CONCAT(LEFT(${users.name}, 1), '***')`,
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
    let driverOffersMap: Record<string, { id: string; status: string; offeredFee: string; counterOfferedFee: string | null }> = {};

    if (subOrderIds.length > 0) {
      const driverExistingOffers = await db
        .select({
          id: deliveryOffers.id,
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
          id: o.id,
          status: o.status,
          offeredFee: o.offeredFee,
          counterOfferedFee: o.counterOfferedFee,
        };
      }
    }

    // BUG-FIX: N+1 query — previously fetched order items for each sub-order in a separate
    // query inside a Promise.all loop, causing 1 + N database round-trips (one per task).
    // Now fetches all items for all sub-orders in a single batch query and groups them in memory.
    let allItemsMap: Record<string, { product_name: string; quantity: number }[]> = {};
    if (subOrderIds.length > 0) {
      const allItems = await db
        .select({
          subOrderId: orderItems.subOrderId,
          product_name: products.name,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(inArray(orderItems.subOrderId, subOrderIds));

      for (const item of allItems) {
        if (!allItemsMap[item.subOrderId]) allItemsMap[item.subOrderId] = [];
        allItemsMap[item.subOrderId].push({ product_name: item.product_name, quantity: item.quantity });
      }
    }

    const tasks: AvailableTaskDTO[] = results.map((res: any) => {
      const existingOffer = driverOffersMap[res.sub_order_id] || null;

      return {
        sub_order_id: res.sub_order_id,
        order_id: res.order_id,
        store_id: res.store_id,
        store_name: res.store_name,
        customer_name: res.customer_name,
        customer_address: res.customer_address,
        items: allItemsMap[res.sub_order_id] || [],
        subtotal: Number(res.subtotal),
        created_at: res.created_at.toISOString(),
        status: res.status as any,
        assigned_driver_id: res.assigned_driver_id,
        driver_offer_id: existingOffer?.id ?? null,
        driver_offer_status: existingOffer?.status ?? null,
        driver_offered_fee: existingOffer?.offeredFee ?? null,
        driver_counter_offered_fee: existingOffer?.counterOfferedFee ?? null,
      };
    });

    // Q: هل يجب تسجيل كل استعلام "عرض المهام المتاحة" في سجلات المراجعة؟
    // A: لا — تسجيل الأحداث في audit_logs مُصمَّم للعمليات التي تُغيّر الحالة
    //    (مثل: قبول طلب، إلغاء طلب، سحب مبلغ). تسجيل كل استعلام قراءة يعني أن
    //    جدول audit_logs سيُملأ بآلاف السجلات غير ذات القيمة كل يوم (خاصةً مع
    //    التحديث التلقائي كل 30 ثانية)، مما يُصعّب إيجاد الأحداث الحقيقية ويُبطئ
    //    الاستعلامات المدقّقة. الإصلاح: حذف هذا التسجيل من عملية القراءة تماماً.
    return { tasks, total };
  }

  /**
   * Returns available tasks GROUPED BY ORDER, so that sub-orders from the same
   * main order appear as one unified card for the driver.
   *
   * Q: لماذا نجمع الطلبات الفرعية على مستوى الطلب الرئيسي؟
   * A: عندما يحتوي الطلب الرئيسي على طلبين فرعيين من متجرين مختلفين،
   *    كان النظام السابق يعرض بطاقتين منفصلتين للسائق وقسمي عروض للعميل.
   *    الصواب: السائق يقدّم عرضاً واحداً يغطي الطلب بالكامل (كل المتاجر)،
   *    والعميل يرى قسماً واحداً لعروض التوصيل يضم جميع العروض المقدّمة.
   */
  async getAvailableOrderTasks(driverId: string): Promise<OrderLevelTask[]> {
    const [driver] = await db.select().from(users).where(and(eq(users.id, driverId), eq(users.role, "DRIVER")));
    if (!driver) throw new Error("UNAUTHORIZED_ROLE");
    if (!driver.isApproved) throw new Error("DRIVER_NOT_APPROVED");

    // Fetch all eligible sub-orders
    const results = await db
      .select({
        sub_order_id: subOrders.id,
        order_id: subOrders.orderId,
        store_name: stores.name,
        customer_name: sql<string>`CONCAT(LEFT(${users.name}, 1), '***')`,
        customer_address: sql<string>`COALESCE((${users.addresses}->>0), 'لا يوجد عنوان محدد')`,
        subtotal: subOrders.subtotal,
        created_at: subOrders.createdAt,
      })
      .from(subOrders)
      .innerJoin(orders, eq(subOrders.orderId, orders.id))
      .innerJoin(stores, eq(subOrders.storeId, stores.id))
      .innerJoin(users, eq(orders.customerId, users.id))
      .where(and(
        eq(subOrders.status, "ACCEPTED"),
        isNull(subOrders.assignedDriverId)
      ))
      .orderBy(asc(subOrders.createdAt));

    if (results.length === 0) return [];

    // Batch-fetch items for all sub-orders
    const subOrderIds = results.map(r => r.sub_order_id);
    const allItems = await db
      .select({
        subOrderId: orderItems.subOrderId,
        product_name: products.name,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(inArray(orderItems.subOrderId, subOrderIds));

    const itemsMap: Record<string, { product_name: string; quantity: number }[]> = {};
    for (const item of allItems) {
      if (!itemsMap[item.subOrderId]) itemsMap[item.subOrderId] = [];
      itemsMap[item.subOrderId].push({ product_name: item.product_name, quantity: item.quantity });
    }

    // Fetch driver's existing offers for these sub-orders
    const driverOffers = await db
      .select({
        subOrderId: deliveryOffers.subOrderId,
        status: deliveryOffers.status,
        offeredFee: deliveryOffers.offeredFee,
        counterOfferedFee: deliveryOffers.counterOfferedFee,
      })
      .from(deliveryOffers)
      .where(and(
        eq(deliveryOffers.driverId, driverId),
        inArray(deliveryOffers.subOrderId, subOrderIds)
      ));

    const driverOffersMap: Record<string, { status: string; offeredFee: string; counterOfferedFee: string | null }> = {};
    for (const offer of driverOffers) {
      driverOffersMap[offer.subOrderId] = {
        status: offer.status,
        offeredFee: offer.offeredFee,
        counterOfferedFee: offer.counterOfferedFee,
      };
    }

    // Group by order_id
    const orderMap: Record<string, OrderLevelTask> = {};
    for (const row of results) {
      if (!orderMap[row.order_id]) {
        orderMap[row.order_id] = {
          order_id: row.order_id,
          customer_name: row.customer_name,
          customer_address: row.customer_address,
          sub_orders: [],
          total_subtotal: 0,
          created_at: row.created_at.toISOString(),
          driver_offer_status: null,
          driver_offered_fee: null,
          driver_counter_offered_fee: null,
        };
      }

      const task = orderMap[row.order_id];
      const subTotal = Number(row.subtotal);
      task.sub_orders.push({
        sub_order_id: row.sub_order_id,
        store_name: row.store_name,
        items: itemsMap[row.sub_order_id] || [],
        subtotal: subTotal,
      });
      task.total_subtotal += subTotal;

      // Determine driver offer status for this order (COUNTERED takes priority over PENDING)
      // Q: لماذا COUNTERED تأخذ الأولوية على PENDING في تحديد الحالة الموحدة؟
      // A: COUNTERED يعني أن العميل تفاعل مع العرض واقترح سعراً آخر — هذا إجراء يتطلب
      //    رداً فورياً من السائق. إظهار PENDING بدلاً من COUNTERED يُخفي هذا التفاعل
      //    ويُسبب تأخيراً في الاستجابة. الأولوية تضمن رؤية السائق للحالة الأهم أولاً.
      const existingOffer = driverOffersMap[row.sub_order_id];
      if (existingOffer) {
        if (!task.driver_offer_status ||
          (existingOffer.status === "COUNTERED" && task.driver_offer_status !== "COUNTERED") ||
          (existingOffer.status === "ACCEPTED" && task.driver_offer_status === null)) {
          task.driver_offer_status = existingOffer.status;
          task.driver_offered_fee = existingOffer.offeredFee;
          task.driver_counter_offered_fee = existingOffer.counterOfferedFee;
        }
      }
    }

    return Object.values(orderMap);
  }
}

export const deliveryService = new DeliveryService();
