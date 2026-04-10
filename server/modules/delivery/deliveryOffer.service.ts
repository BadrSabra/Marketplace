import { db } from "../../db";
import { deliveryOffers, subOrders, wallets, walletTransactions, orders, users, ledger } from "@shared/schema";
// Q: هل يجب استيراد sql من drizzle-orm ديناميكياً داخل دالة getOffersForSubOrder؟
// A: لا — sql دالة مساعدة ثابتة من drizzle-orm لا تتغير بين الاستدعاءات.
//    استيرادها ديناميكياً داخل الدالة يُضيف Promise overhead في كل استدعاء
//    دون أي فائدة تقنية. الإصلاح: إضافتها للاستيراد الثابت في بداية الملف.
import { eq, and, ne, sql, inArray, not, isNull } from "drizzle-orm";
import { auditService } from "../../services/auditService";
import { deliveryOtpService } from "./deliveryOtp.service";
import { chatService } from "../chat/chat.service";
import { notifyUser } from "../notifications/push.service";
// Q: لماذا نضيف money utility لـ deliveryOffer.service.ts؟
// A: عند قبول العرض، تُخصم رسوم التوصيل من محفظة العميل مباشرةً.
//    الكود الحالي يستخدم parseFloat + arithmetic + toFixed وهو عرضة لأخطاء IEEE 754.
//    الإصلاح: استبدال parseFloat arithmetic بـ money.isLessThan و money.subtract.
//
// ⚠️ خطأ جديد تكشفه هذا الإصلاح:
//    عند counterOffer: يُقارَن counterFee بـ offer.offeredFee بـ `>=` (على numbers).
//    بعد الإصلاح، يجب استخدام money.isGreaterThan أو money.equals للمقارنة.
//    الكود الحالي `if (counterFee >= parseFloat(offer.offeredFee))` خاطئ مزدوجاً:
//    1. counterFee number من Zod، offeredFee string من DB — مقارنة مختلطة الأنواع
//    2. IEEE 754 — مقارنة float غير موثوقة عند القيم الحدية
import { money } from "../../utils/money";

export class DeliveryOfferService {
  async createOffer(subOrderId: string, driverId: string, data: { proposedFee: number; notes?: string }) {
    return await db.transaction(async (tx) => {
      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, subOrderId)).for("update");
      if (!subOrder || subOrder.status !== "ACCEPTED") throw new Error("TASK_NOT_AVAILABLE");

      const [existing] = await tx
        .select()
        .from(deliveryOffers)
        .where(and(
          eq(deliveryOffers.subOrderId, subOrderId),
          eq(deliveryOffers.driverId, driverId),
          eq(deliveryOffers.status, "PENDING")
        ));
      if (existing) throw new Error("ALREADY_SUBMITTED");

      const [offer] = await tx.insert(deliveryOffers).values({
        subOrderId,
        driverId,
        offeredFee: data.proposedFee.toString(),
        status: "PENDING",
      }).returning();

      await auditService.logEvent({
        actionType: "DELIVERY_OFFER_SUBMITTED",
        entityType: "delivery_offer",
        entityId: offer.id,
        performedByUserId: driverId,
        performedByRole: "DRIVER",
        metadata: { subOrderId, proposedFee: data.proposedFee }
      });

      // Notify customer: driver submitted an offer
      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, subOrder.orderId)).limit(1);
      if (parentOrder) {
        notifyUser(
          parentOrder.customerId,
          "NEW_OFFER",
          "عرض توصيل جديد",
          `سائق قدّم عرضاً للتوصيل بمبلغ ${data.proposedFee} جنيه`,
          { subOrderId, offerId: offer.id, proposedFee: data.proposedFee }
        ).catch(console.error);
      }

      return offer;
    });
  }

  /**
   * Verifies that the given customerId owns the sub-order (via parent order).
   * Returns true if ownership is confirmed, false otherwise.
   * Used as an authorization guard before exposing sensitive offer data.
   */
  async verifySubOrderOwnership(subOrderId: string, customerId: string): Promise<boolean> {
    // Q: هل يكفي التحقق من الطلب الفرعي فقط دون جلب الطلب الأصلي؟
    // A: لا — الطلب الفرعي لا يحتوي على customerId مباشرةً؛ العلاقة هي:
    //    sub_orders.order_id → orders.id → orders.customer_id.
    //    لذا يجب جلب الطلب الأصلي لمعرفة من يملكه.
    const [subOrder] = await db.select({ orderId: subOrders.orderId }).from(subOrders).where(eq(subOrders.id, subOrderId));
    if (!subOrder) return false;
    const [parentOrder] = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, subOrder.orderId));
    if (!parentOrder) return false;
    return parentOrder.customerId === customerId;
  }

  /**
   * Get all actionable offers for a sub-order (for customer to view and act on)
   * Includes PENDING and COUNTERED offers
   */
  async getOffersForSubOrder(subOrderId: string) {
    const offers = await db
      .select({
        id: deliveryOffers.id,
        subOrderId: deliveryOffers.subOrderId,
        driverId: deliveryOffers.driverId,
        offeredFee: deliveryOffers.offeredFee,
        status: deliveryOffers.status,
        counterOfferedFee: deliveryOffers.counterOfferedFee,
        createdAt: deliveryOffers.createdAt,
        driverName: users.name,
        driverPhone: users.phone,
        driverTransportType: users.transportType,
      })
      .from(deliveryOffers)
      .innerJoin(users, eq(deliveryOffers.driverId, users.id))
      .where(and(
        eq(deliveryOffers.subOrderId, subOrderId),
        sql`${deliveryOffers.status} IN ('PENDING', 'COUNTERED')`
      ));
    return offers;
  }

  /**
   * Customer accepts a specific driver offer:
   * 1. Deduct delivery fee from customer wallet
   * 2. Assign driver to sub-order → IN_TRANSIT
   * 3. Reject other offers
   * 4. Generate OTP
   */
  async customerAcceptOffer(offerId: string, customerId: string) {
    return await db.transaction(async (tx) => {
      // Fetch offer
      const [offer] = await tx.select().from(deliveryOffers).where(eq(deliveryOffers.id, offerId)).for("update");
      if (!offer || offer.status !== "PENDING") throw new Error("OFFER_NOT_AVAILABLE");

      // Fetch sub-order
      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, offer.subOrderId)).for("update");
      if (!subOrder || subOrder.status !== "ACCEPTED") throw new Error("SUBORDER_NOT_AVAILABLE");
      if (subOrder.assignedDriverId) throw new Error("ALREADY_ASSIGNED");

      // Verify the customer owns this order
      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, subOrder.orderId));
      if (!parentOrder || parentOrder.customerId !== customerId) throw new Error("UNAUTHORIZED");

      // Q: لماذا نحوّل offer.offeredFee إلى string قبل استخدامه مع money؟
      // A: Drizzle قد يُعيد الحقل كـ string أو number حسب إعداد الـ postgres driver.
      //    تحويله إلى string صريح يضمن التوافق مع money utility في كلا الحالتين.
      // Q: لماذا نُعرّف deliveryFee و deliveryFeeStr كلاهما؟
      // A: deliveryFeeStr يُستخدم مع money utility (تتطلب string).
      //    deliveryFee يُستخدم في الإشعارات وسجلات التدقيق (قيمة مقروءة للإنسان).
      //    قبل هذا الإصلاح كان deliveryFeeStr فقط هو المعرَّف، فكان deliveryFee
      //    يُحلّ إلى `undefined` مما يُسبب إشعارات "بمبلغ undefined جنيه" وبيانات
      //    تدقيق تالفة. الإصلاح: تعريف صريح لكلا المتغيرين.
      //
      // ⚠️ خطأ جديد تكشفه هذا الإصلاح:
      //    إذا كان offer.offeredFee يُعيد قيمة غير رقمية من DB (تلف بيانات)،
      //    فإن money.format(deliveryFeeStr) ستُطلق استثناءً. هذا سلوك صحيح
      //    (fail-fast) بدلاً من تخزين undefined صامتاً في الإشعارات.
      const deliveryFeeStr = offer.offeredFee.toString();
      const deliveryFee = money.format(deliveryFeeStr);

      // Deduct delivery fee from customer wallet
      const [customerWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, customerId))
        .for("update");

      if (!customerWallet) throw new Error("WALLET_NOT_FOUND");

      // Q: لماذا money.isLessThan بدلاً من currentBalance < deliveryFee؟
      // A: deliveryFeeStr هو الآن string — لا يمكن مقارنتها بـ parseFloat بدون فقدان الدقة.
      //    money.isLessThan تُحوّل الاثنين لقروش وتُقارنهما بدقة كاملة.
      if (money.isLessThan(customerWallet.balance, deliveryFeeStr)) throw new Error("INSUFFICIENT_BALANCE");

      const newBalance = money.subtract(customerWallet.balance, deliveryFeeStr);
      await tx.update(wallets)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(wallets.id, customerWallet.id));

      // Log the delivery fee deduction as a wallet transaction
      await tx.insert(walletTransactions).values({
        walletId: customerWallet.id,
        type: "WITHDRAWAL",
        amount: deliveryFeeStr,
        relatedOrderId: parentOrder.id,
        status: "COMPLETED",
        notes: `رسوم توصيل - عرض السائق #${offerId.slice(0, 8)}`,
      });

      // BUG-FIX-12: Missing ledger entry when customer accepts delivery offer.
      // Delivery fee is a real financial movement and must be recorded in the ledger.
      await tx.insert(ledger).values({
        referenceId: parentOrder.id,
        debitUserId: customerId,
        creditUserId: null,
        amount: deliveryFeeStr,
        type: "WITHDRAWAL",
      });

      // Update sub-order: assign driver, update expectedDeliveryFee, set IN_TRANSIT
      // Q: لماذا نستخدم deliveryFee مباشرةً بدلاً من formattedDeliveryFee منفصل؟
      // A: deliveryFee = money.format(deliveryFeeStr) بالفعل — إنشاء formattedDeliveryFee
      //    ثانٍ يستدعي money.format مرةً ثانيةً على نفس المدخل ويُعيد نفس القيمة.
      //    التكرار يُشوّش القارئ ويوحي بأن القيمتين مختلفتان. الإصلاح: حذف المتغير
      //    الزائد واستخدام deliveryFee مباشرةً.
      const [updatedSubOrder] = await tx
        .update(subOrders)
        .set({
          assignedDriverId: offer.driverId,
          expectedDeliveryFee: deliveryFee,
          status: "IN_TRANSIT",
          updatedAt: new Date(),
        })
        .where(eq(subOrders.id, offer.subOrderId))
        .returning();

      // Accept this offer, reject all others
      await tx.update(deliveryOffers)
        .set({ status: "ACCEPTED", updatedAt: new Date() })
        .where(eq(deliveryOffers.id, offerId));

      await tx.update(deliveryOffers)
        .set({ status: "REJECTED", updatedAt: new Date() })
        .where(and(
          eq(deliveryOffers.subOrderId, offer.subOrderId),
          ne(deliveryOffers.id, offerId)
        ));

      await auditService.logEvent({
        actionType: "DELIVERY_OFFER_ACCEPTED_BY_CUSTOMER",
        entityType: "delivery_offer",
        entityId: offerId,
        performedByUserId: customerId,
        performedByRole: "CUSTOMER",
        newValue: { status: "ACCEPTED", assignedDriverId: offer.driverId, deliveryFee }
      });

      // Notify driver that their offer was accepted
      notifyUser(
        offer.driverId,
        "OFFER_ACCEPTED",
        "تم قبول عرضك",
        `تم قبول عرضك للتوصيل بمبلغ ${deliveryFee} جنيه`,
        { offerId, subOrderId: offer.subOrderId, deliveryFee }
      ).catch(console.error);

      return updatedSubOrder;
    }).then(async (updatedSubOrder) => {
      // Generate OTP after transaction commits
      await deliveryOtpService.generateOtp(updatedSubOrder.orderId, updatedSubOrder.id);

      // Create ORDER_DRIVER chat room between customer and driver
      try {
        const [parentOrder] = await db.select().from(orders).where(eq(orders.id, updatedSubOrder.orderId));
        if (parentOrder && updatedSubOrder.assignedDriverId) {
          const existingRoom = await chatService.findRoomByReference("ORDER_DRIVER", updatedSubOrder.id);
          if (!existingRoom) {
            await chatService.createRoom("ORDER_DRIVER", [parentOrder.customerId, updatedSubOrder.assignedDriverId], {
              referenceId: updatedSubOrder.id,
              title: "تنسيق التوصيل",
            });
          }
        }
      } catch {}

      return updatedSubOrder;
    });
  }

  /**
   * Customer rejects a specific driver offer
   */
  async customerRejectOffer(offerId: string, customerId: string) {
    return await db.transaction(async (tx) => {
      // BUG-FIX: Was fetching the offer without FOR UPDATE, creating a TOCTOU race condition.
      // A concurrent accept and reject could both pass the status === "PENDING" check and both
      // proceed, leading to an inconsistent state (offer both accepted and rejected).
      // Q: هل يجب السماح برفض العروض في حالة COUNTERED أيضاً؟
      // A: نعم. عندما يقدّم العميل عرضاً مضاداً (COUNTERED)، يصبح العرض في حالة COUNTERED.
      //    إذا أراد العميل لاحقاً الرجوع عن هذا العرض (أو لم يرد السائق)، لم يكن بإمكانه
      //    ذلك — الشرط السابق `offer.status !== "PENDING"` يرفض محاولة الرفض فوراً، مما
      //    يترك العروض في حالة COUNTERED معلّقة إلى الأبد دون أي مسار للخروج منها.
      //    الإصلاح: السماح بالرفض لحالتَي PENDING و COUNTERED معاً.
      const [offer] = await tx.select().from(deliveryOffers).where(eq(deliveryOffers.id, offerId)).for("update");
      if (!offer || !["PENDING", "COUNTERED"].includes(offer.status)) throw new Error("OFFER_NOT_AVAILABLE");

      // Q: هل يجب التحقق من وجود subOrder قبل الوصول لـ subOrder.orderId؟
      // A: نعم — في سيناريو نادر (بيانات تالفة أو حذف يدوي)، قد تكون deliveryOffers
      //    تشير لـ subOrderId غير موجود. الوصول لـ subOrder.orderId بدون فحص يُطلق
      //    TypeError: Cannot read properties of undefined يصل للمستخدم كـ 500 غير مفهوم.
      //    الإصلاح: إضافة فحص وإطلاق UNAUTHORIZED (بما أنه يتعذر التحقق من الملكية).
      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, offer.subOrderId));
      if (!subOrder) throw new Error("UNAUTHORIZED");
      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, subOrder.orderId));
      if (!parentOrder || parentOrder.customerId !== customerId) throw new Error("UNAUTHORIZED");

      await tx.update(deliveryOffers)
        .set({ status: "REJECTED", updatedAt: new Date() })
        .where(eq(deliveryOffers.id, offerId));

      // Notify driver that their offer was rejected
      notifyUser(
        offer.driverId,
        "OFFER_REJECTED",
        "تم رفض عرضك",
        "تم رفض عرضك للتوصيل من قِبل العميل",
        { offerId, subOrderId: offer.subOrderId }
      ).catch(console.error);

      return { success: true };
    });
  }

  /**
   * Customer sends a counter-offer (lower price) to a driver
   */
  async customerCounterOffer(offerId: string, customerId: string, counterFee: number) {
    // Q: هل يكفي أن يتحقق الـ controller فقط من أن counterFee موجب؟
    // A: لا — مبدأ Defense in Depth يقتضي التحقق على كل طبقة منفصلة.
    //    إن استُدعيت هذه الدالة مباشرةً من كود آخر (اختبارات، migrations، سكريبتات)
    //    دون المرور بالـ controller، لن يكون هناك أي حاجز. counterFee = 0 يُفيت
    //    شرط `counterFee >= offeredFee` لأن 0 < أي رسوم موجبة، فيُسجَّل عرض مضاد
    //    بقيمة صفر وهو بيانات فاسدة تُفسد نظام العروض والتسعير.
    //    الإصلاح: إضافة فحص صريح على مستوى الـ service.
    if (counterFee <= 0) throw new Error("COUNTER_FEE_MUST_BE_POSITIVE");

    return await db.transaction(async (tx) => {
      const [offer] = await tx.select().from(deliveryOffers).where(eq(deliveryOffers.id, offerId)).for("update");
      if (!offer || offer.status !== "PENDING") throw new Error("OFFER_NOT_AVAILABLE");

      // Q: لماذا نستخدم money.isLessThan بدلاً من `counterFee >= parseFloat(offer.offeredFee)`؟
      // A: counterFee هو number من Zod، و offer.offeredFee هو string من DB.
      //    المقارنة المباشرة تعتمد على coercion ضمني قد يُخطئ عند القيم الحدية.
      //    money.isLessThan تُحوّل الاثنين لقروش وتُقارنهما كأعداد صحيحة — أدق وأوضح.
      //    الشرط: counterFee يجب أن يكون أصغر من offer.offeredFee (NOT less than = الرفض).
      if (!money.isLessThan(counterFee, offer.offeredFee)) throw new Error("COUNTER_MUST_BE_LOWER");

      // Q: هل يجب التحقق من وجود subOrder قبل الوصول لـ subOrder.orderId في customerCounterOffer؟
      // A: نعم — نفس مشكلة customerRejectOffer: غياب الفحص يُطلق TypeError إذا كان
      //    الطلب الفرعي محذوفاً. الإصلاح: فحص subOrder قبل استخدامه مع UNAUTHORIZED.
      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, offer.subOrderId));
      if (!subOrder) throw new Error("UNAUTHORIZED");
      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, subOrder.orderId));
      if (!parentOrder || parentOrder.customerId !== customerId) throw new Error("UNAUTHORIZED");

      const [updatedOffer] = await tx.update(deliveryOffers)
        .set({
          status: "COUNTERED",
          counterOfferedFee: counterFee.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(deliveryOffers.id, offerId))
        .returning();

      await auditService.logEvent({
        actionType: "DELIVERY_OFFER_COUNTERED",
        entityType: "delivery_offer",
        entityId: offerId,
        performedByUserId: customerId,
        performedByRole: "CUSTOMER",
        newValue: { counterFee, originalFee: offer.offeredFee }
      });

      // Notify driver about counter-offer
      notifyUser(
        offer.driverId,
        "OFFER_COUNTERED",
        "عرض مضاد",
        `قدّم العميل عرضاً مضاداً بمبلغ ${counterFee} جنيه`,
        { offerId, subOrderId: offer.subOrderId, counterFee, originalFee: offer.offeredFee }
      ).catch(console.error);

      return updatedOffer;
    });
  }

  /**
   * Driver accepts the customer's counter-offer:
   * 1. Deduct the agreed counter fee from customer wallet
   * 2. Assign driver to sub-order → IN_TRANSIT
   * 3. Reject other offers
   * 4. Generate OTP
   */
  async driverAcceptCounterOffer(offerId: string, driverId: string) {
    return await db.transaction(async (tx) => {
      // Offer must be in COUNTERED state and belong to this driver
      const [offer] = await tx.select().from(deliveryOffers).where(eq(deliveryOffers.id, offerId)).for("update");
      if (!offer || offer.status !== "COUNTERED") throw new Error("OFFER_NOT_COUNTERED");
      if (offer.driverId !== driverId) throw new Error("UNAUTHORIZED");
      if (!offer.counterOfferedFee) throw new Error("COUNTER_FEE_MISSING");

      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, offer.subOrderId)).for("update");
      if (!subOrder || subOrder.status !== "ACCEPTED") throw new Error("SUBORDER_NOT_AVAILABLE");
      if (subOrder.assignedDriverId) throw new Error("ALREADY_ASSIGNED");

      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, subOrder.orderId));
      if (!parentOrder) throw new Error("ORDER_NOT_FOUND");

      // Q: لماذا نستخدم money utility لحساب خصم الـ counter offer المقبول؟
      // A: نفس مبرر acceptOffer — خصم رسوم التوصيل من محفظة العميل عملية مالية حرجة.
      //    offer.counterOfferedFee قد يكون string أو number حسب إعداد الـ driver.
      //    تحويله لـ string صريح ثم استخدام money يضمن الدقة في كلا الحالتين.
      if (!offer.counterOfferedFee) throw new Error("COUNTER_FEE_MISSING");
      // Q: لماذا نُعرّف agreedFee و agreedFeeStr كلاهما هنا؟
      // A: نفس مشكلة customerAcceptOffer — كان agreedFeeStr فقط هو المعرَّف،
      //    فكان agreedFee يُحلّ إلى `undefined` في سجلات التدقيق والإشعارات
      //    مما يُسبب "بمبلغ undefined جنيه" في رسائل السائق والعميل.
      //    الإصلاح: تعريف agreedFee صراحةً من money.format بعد التحقق من القيمة.
      //
      // ⚠️ خطأ جديد تكشفه هذا الإصلاح:
      //    money.format ستُطلق استثناءً إذا كانت counterOfferedFee بيانات تالفة.
      //    هذا يعني فشلاً صريحاً بدلاً من تخزين undefined صامتاً — سلوك أكثر أماناً.
      const agreedFeeStr = offer.counterOfferedFee.toString();
      const agreedFee = money.format(agreedFeeStr);

      // Deduct agreed counter fee from customer wallet
      const [customerWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, parentOrder.customerId))
        .for("update");

      if (!customerWallet) throw new Error("WALLET_NOT_FOUND");

      if (money.isLessThan(customerWallet.balance, agreedFeeStr)) throw new Error("INSUFFICIENT_BALANCE");

      const newBalance = money.subtract(customerWallet.balance, agreedFeeStr);
      await tx.update(wallets)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(wallets.id, customerWallet.id));

      await tx.insert(walletTransactions).values({
        walletId: customerWallet.id,
        type: "WITHDRAWAL",
        amount: agreedFeeStr,
        relatedOrderId: parentOrder.id,
        status: "COMPLETED",
        notes: `رسوم توصيل - عرض مضاد مقبول #${offerId.slice(0, 8)}`,
      });

      await tx.insert(ledger).values({
        referenceId: parentOrder.id,
        debitUserId: parentOrder.customerId,
        creditUserId: null,
        amount: agreedFeeStr,
        type: "WITHDRAWAL",
      });

      // Q: لماذا نستخدم agreedFee مباشرةً بدلاً من formattedAgreedFee منفصل؟
      // A: agreedFee = money.format(agreedFeeStr) بالفعل — إنشاء formattedAgreedFee ثانٍ
      //    يستدعي money.format مرةً ثانيةً على نفس المدخل ويُعيد نفس القيمة تماماً.
      //    التكرار يُربك القارئ ويوحي بفرق غير موجود. الإصلاح: استخدام agreedFee مباشرةً.
      // Assign driver at agreed counter fee → IN_TRANSIT
      const [updatedSubOrder] = await tx
        .update(subOrders)
        .set({
          assignedDriverId: driverId,
          expectedDeliveryFee: agreedFee,
          status: "IN_TRANSIT",
          updatedAt: new Date(),
        })
        .where(eq(subOrders.id, offer.subOrderId))
        .returning();

      // Accept this offer, reject all others for this sub-order
      await tx.update(deliveryOffers)
        .set({ status: "ACCEPTED", updatedAt: new Date() })
        .where(eq(deliveryOffers.id, offerId));

      await tx.update(deliveryOffers)
        .set({ status: "REJECTED", updatedAt: new Date() })
        .where(and(
          eq(deliveryOffers.subOrderId, offer.subOrderId),
          ne(deliveryOffers.id, offerId)
        ));

      await auditService.logEvent({
        actionType: "DELIVERY_OFFER_COUNTER_ACCEPTED_BY_DRIVER",
        entityType: "delivery_offer",
        entityId: offerId,
        performedByUserId: driverId,
        performedByRole: "DRIVER",
        newValue: { status: "ACCEPTED", agreedFee, subOrderId: offer.subOrderId }
      });

      // Notify customer
      notifyUser(
        parentOrder.customerId,
        "OFFER_ACCEPTED",
        "السائق قبل عرضك المضاد",
        `وافق السائق على رسوم التوصيل بمبلغ ${agreedFee} جنيه وسيتوجه إليك الآن`,
        { offerId, subOrderId: offer.subOrderId, agreedFee }
      ).catch(console.error);

      return updatedSubOrder;
    }).then(async (updatedSubOrder) => {
      await deliveryOtpService.generateOtp(updatedSubOrder.orderId, updatedSubOrder.id);

      try {
        const [parentOrder] = await db.select().from(orders).where(eq(orders.id, updatedSubOrder.orderId));
        if (parentOrder && updatedSubOrder.assignedDriverId) {
          const existingRoom = await chatService.findRoomByReference("ORDER_DRIVER", updatedSubOrder.id);
          if (!existingRoom) {
            await chatService.createRoom("ORDER_DRIVER", [parentOrder.customerId, updatedSubOrder.assignedDriverId], {
              referenceId: updatedSubOrder.id,
              title: "تنسيق التوصيل",
            });
          }
        }
      } catch {}

      return updatedSubOrder;
    });
  }

  // ─── ORDER-LEVEL OFFER METHODS ────────────────────────────────────────────
  // Q: لماذا نُنشئ methods على مستوى الطلب الرئيسي بدلاً من الطلب الفرعي؟
  // A: عندما يحتوي الطلب الرئيسي على طلبين فرعيين، كان النظام السابق يُنشئ
  //    عرضاً منفصلاً لكل طلب فرعي، مما يُظهر بطاقتين للسائق وقسمين للعميل.
  //    الصواب: السائق يُقدّم عرضاً واحداً يشمل كل طلبات النظام، والعميل يرى
  //    قسماً واحداً لعروض التوصيل. الـ methods التالية تحقق ذلك.

  /**
   * Driver submits ONE offer for ALL sub-orders of a main order.
   * Creates one delivery_offer record per sub-order (same fee for all).
   * The fee represents the total delivery cost for the entire order.
   */
  async createOrderOffer(orderId: string, driverId: string, proposedFee: number) {
    return await db.transaction(async (tx) => {
      // Verify driver is approved
      const [driver] = await tx.select().from(users).where(and(eq(users.id, driverId), eq(users.role, "DRIVER")));
      if (!driver || !driver.isApproved) throw new Error("DRIVER_NOT_APPROVED");

      // Get all ACCEPTED, unassigned sub-orders for this order
      const eligibleSubOrders = await tx
        .select()
        .from(subOrders)
        .where(and(
          eq(subOrders.orderId, orderId),
          eq(subOrders.status, "ACCEPTED"),
          isNull(subOrders.assignedDriverId)
        ))
        .for("update");

      // Q: ماذا يحدث إذا لم يكن هناك طلبات فرعية مؤهلة؟
      // A: يعني ذلك أن الطلب الرئيسي لم تقبله المتاجر بعد أو تم تعيين سائق له.
      //    في كلا الحالتين الطلب غير متاح للتوصيل — يجب إطلاق خطأ واضح.
      if (eligibleSubOrders.length === 0) throw new Error("NO_ELIGIBLE_SUBORDERS");

      // Check for duplicate offer from this driver on any sub-order of this order
      const existingOffers = await tx
        .select()
        .from(deliveryOffers)
        .where(and(
          eq(deliveryOffers.driverId, driverId),
          inArray(deliveryOffers.subOrderId, eligibleSubOrders.map(s => s.id)),
          sql`${deliveryOffers.status} IN ('PENDING', 'COUNTERED', 'ACCEPTED')`
        ));

      if (existingOffers.length > 0) throw new Error("ALREADY_SUBMITTED");

      // Create one offer per sub-order (all with same fee = total order delivery cost)
      const createdOffers = await tx.insert(deliveryOffers).values(
        eligibleSubOrders.map(sub => ({
          subOrderId: sub.id,
          driverId,
          offeredFee: proposedFee.toString(),
          status: "PENDING" as const,
        }))
      ).returning();

      await auditService.logEvent({
        actionType: "DELIVERY_OFFER_SUBMITTED",
        entityType: "delivery_offer",
        entityId: orderId,
        performedByUserId: driverId,
        performedByRole: "DRIVER",
        metadata: { orderId, proposedFee, subOrderCount: eligibleSubOrders.length }
      });

      // Notify customer
      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (parentOrder) {
        notifyUser(
          parentOrder.customerId,
          "NEW_OFFER",
          "عرض توصيل جديد",
          `سائق قدّم عرضاً للتوصيل بمبلغ ${proposedFee} جنيه`,
          { orderId, proposedFee }
        ).catch(console.error);
      }

      return createdOffers;
    });
  }

  /**
   * Get all actionable delivery offers for a main order, grouped by driver.
   * Q: لماذا نجمع العروض بالسائق بدلاً من إعادتها لكل طلب فرعي؟
   * A: السائق يُقدّم عرضاً واحداً للطلب كله (createOrderOffer).
   *    إظهار عروض منفصلة لكل طلب فرعي يُعيد نفس المشكلة الأصلية للعميل:
   *    سيرى عرضاً واحداً مكرراً لكل متجر بدلاً من عرض موحّد.
   */
  async getOffersForOrder(orderId: string, customerId: string) {
    // Verify ownership
    const [parentOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!parentOrder || parentOrder.customerId !== customerId) throw new Error("UNAUTHORIZED");

    // Get all sub-orders for this order
    const orderSubOrders = await db.select({ id: subOrders.id }).from(subOrders).where(eq(subOrders.orderId, orderId));
    if (orderSubOrders.length === 0) return [];

    const subOrderIds = orderSubOrders.map(s => s.id);

    // Get all PENDING/COUNTERED offers for these sub-orders, with driver info
    const rawOffers = await db
      .select({
        id: deliveryOffers.id,
        subOrderId: deliveryOffers.subOrderId,
        driverId: deliveryOffers.driverId,
        offeredFee: deliveryOffers.offeredFee,
        counterOfferedFee: deliveryOffers.counterOfferedFee,
        status: deliveryOffers.status,
        driverName: users.name,
        driverTransportType: users.transportType,
      })
      .from(deliveryOffers)
      .innerJoin(users, eq(deliveryOffers.driverId, users.id))
      .where(and(
        inArray(deliveryOffers.subOrderId, subOrderIds),
        sql`${deliveryOffers.status} IN ('PENDING', 'COUNTERED')`
      ));

    // Group by driverId — each driver has one logical offer for the whole order
    // Q: ماذا نفعل إذا كان للسائق عروض بحالات مختلفة على طلبات فرعية مختلفة؟
    // A: هذا يحدث فقط إذا تم تقديم عروض فردية (قديمة) بدلاً من order-level.
    //    نعطي الأولوية لـ COUNTERED على PENDING لأن العميل أبدى رأيه بالسعر.
    const grouped: Record<string, {
      driverId: string;
      driverName: string;
      driverTransportType: string | null;
      offeredFee: string;
      counterOfferedFee: string | null;
      status: 'PENDING' | 'COUNTERED';
    }> = {};

    for (const offer of rawOffers) {
      const key = offer.driverId;
      if (!grouped[key]) {
        grouped[key] = {
          driverId: offer.driverId,
          driverName: offer.driverName,
          driverTransportType: offer.driverTransportType,
          offeredFee: offer.offeredFee,
          counterOfferedFee: offer.counterOfferedFee,
          status: offer.status as 'PENDING' | 'COUNTERED',
        };
      } else {
        // COUNTERED takes priority over PENDING
        if (offer.status === "COUNTERED" && grouped[key].status !== "COUNTERED") {
          grouped[key].status = "COUNTERED";
          grouped[key].counterOfferedFee = offer.counterOfferedFee;
        }
      }
    }

    return Object.values(grouped);
  }

  /**
   * Customer accepts a driver's offer for ALL sub-orders of an order.
   * Deducts the delivery fee ONCE (it covers the whole order).
   * Sets all eligible sub-orders to IN_TRANSIT.
   */
  async customerAcceptOrderOffer(orderId: string, driverId: string, customerId: string) {
    return await db.transaction(async (tx) => {
      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!parentOrder || parentOrder.customerId !== customerId) throw new Error("UNAUTHORIZED");

      // Lock all eligible sub-orders of this order
      const orderSubOrders = await tx
        .select()
        .from(subOrders)
        .where(and(
          eq(subOrders.orderId, orderId),
          eq(subOrders.status, "ACCEPTED"),
          isNull(subOrders.assignedDriverId)
        ))
        .for("update");

      if (orderSubOrders.length === 0) throw new Error("NO_SUBORDERS_AVAILABLE");

      const subOrderIds = orderSubOrders.map(s => s.id);

      // Get driver's offers for these sub-orders
      const driverOffers = await tx
        .select()
        .from(deliveryOffers)
        .where(and(
          eq(deliveryOffers.driverId, driverId),
          inArray(deliveryOffers.subOrderId, subOrderIds),
          sql`${deliveryOffers.status} IN ('PENDING', 'COUNTERED')`
        ))
        .for("update");

      if (driverOffers.length === 0) throw new Error("OFFER_NOT_AVAILABLE");

      // The fee is the same across all offers (one fee for the whole order)
      // Q: لماذا نأخذ السعر من العرض الأول فقط دون جمع الأسعار؟
      // A: عند إنشاء العرض (createOrderOffer)، يُخزَّن نفس السعر الإجمالي في كل
      //    عرض فرعي. السعر لا يمثّل سعر طلب فرعي واحد بل سعر الطلب كاملاً.
      //    جمع الأسعار سيُضاعف المبلغ المخصوم من محفظة العميل بشكل خاطئ.
      const representativeOffer = driverOffers[0];
      const feeStr = representativeOffer.status === "COUNTERED" && representativeOffer.counterOfferedFee
        ? representativeOffer.counterOfferedFee.toString()
        : representativeOffer.offeredFee.toString();
      const deliveryFee = money.format(feeStr);

      // Deduct fee ONCE from customer wallet
      const [customerWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, customerId))
        .for("update");

      if (!customerWallet) throw new Error("WALLET_NOT_FOUND");
      if (money.isLessThan(customerWallet.balance, feeStr)) throw new Error("INSUFFICIENT_BALANCE");

      const newBalance = money.subtract(customerWallet.balance, feeStr);
      await tx.update(wallets).set({ balance: newBalance, updatedAt: new Date() }).where(eq(wallets.id, customerWallet.id));

      await tx.insert(walletTransactions).values({
        walletId: customerWallet.id,
        type: "WITHDRAWAL",
        amount: feeStr,
        relatedOrderId: orderId,
        status: "COMPLETED",
        notes: `رسوم توصيل للطلب #${orderId.slice(0, 8)}`,
      });

      await tx.insert(ledger).values({
        referenceId: orderId,
        debitUserId: customerId,
        creditUserId: null,
        amount: feeStr,
        type: "WITHDRAWAL",
      });

      // Assign driver to ALL sub-orders
      // Q: لماذا نضع رسوم التوصيل على الطلب الفرعي الأول فقط (وصفر على الباقي)؟
      // A: في ملخص الدفع، يتم جمع expectedDeliveryFee من كل الطلبات الفرعية.
      //    إذا وضعنا نفس الرسوم الكلية على كل طلب فرعي، سيُجمَع المبلغ مرتين أو أكثر.
      //    الحل: الطلب الفرعي الأول يحمل الرسوم الكاملة، والباقي بصفر. المجموع صحيح.
      for (let i = 0; i < orderSubOrders.length; i++) {
        const sub = orderSubOrders[i];
        const feeForThisSub = i === 0 ? deliveryFee : "0.00";
        await tx.update(subOrders).set({
          assignedDriverId: driverId,
          expectedDeliveryFee: feeForThisSub,
          status: "IN_TRANSIT",
          updatedAt: new Date(),
        }).where(eq(subOrders.id, sub.id));
      }

      // Accept driver's offers, reject all others for all sub-orders
      const driverOfferIds = driverOffers.map(o => o.id);
      await tx.update(deliveryOffers).set({ status: "ACCEPTED", updatedAt: new Date() })
        .where(inArray(deliveryOffers.id, driverOfferIds));

      await tx.update(deliveryOffers).set({ status: "REJECTED", updatedAt: new Date() })
        .where(and(
          inArray(deliveryOffers.subOrderId, subOrderIds),
          not(inArray(deliveryOffers.id, driverOfferIds))
        ));

      await auditService.logEvent({
        actionType: "DELIVERY_OFFER_ACCEPTED_BY_CUSTOMER",
        entityType: "delivery_offer",
        entityId: orderId,
        performedByUserId: customerId,
        performedByRole: "CUSTOMER",
        newValue: { status: "ACCEPTED", assignedDriverId: driverId, deliveryFee }
      });

      notifyUser(
        driverId,
        "OFFER_ACCEPTED",
        "تم قبول عرضك",
        `تم قبول عرضك للتوصيل بمبلغ ${deliveryFee} جنيه`,
        { orderId, deliveryFee }
      ).catch(console.error);

      return { success: true, subOrderIds, deliveryFee };
    }).then(async (result) => {
      // Generate OTP for all sub-orders after transaction commits
      for (const subOrderId of result.subOrderIds) {
        await deliveryOtpService.generateOtp(orderId, subOrderId).catch(console.error);
      }

      // Create chat room between customer and driver
      try {
        const [parentOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
        if (parentOrder) {
          const primarySubOrderId = result.subOrderIds[0];
          const existingRoom = await chatService.findRoomByReference("ORDER_DRIVER", primarySubOrderId);
          if (!existingRoom) {
            await chatService.createRoom("ORDER_DRIVER", [parentOrder.customerId, driverId], {
              referenceId: primarySubOrderId,
              title: "تنسيق التوصيل",
            });
          }
        }
      } catch {}

      return result;
    });
  }

  /**
   * Customer rejects a driver's offer for ALL sub-orders of an order.
   */
  async customerRejectOrderOffer(orderId: string, driverId: string, customerId: string) {
    return await db.transaction(async (tx) => {
      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, orderId));
      if (!parentOrder || parentOrder.customerId !== customerId) throw new Error("UNAUTHORIZED");

      const orderSubOrders = await tx.select({ id: subOrders.id }).from(subOrders).where(eq(subOrders.orderId, orderId));
      const subOrderIds = orderSubOrders.map(s => s.id);

      const driverOffers = await tx
        .select()
        .from(deliveryOffers)
        .where(and(
          eq(deliveryOffers.driverId, driverId),
          inArray(deliveryOffers.subOrderId, subOrderIds),
          sql`${deliveryOffers.status} IN ('PENDING', 'COUNTERED')`
        ))
        .for("update");

      if (driverOffers.length === 0) throw new Error("OFFER_NOT_AVAILABLE");

      await tx.update(deliveryOffers)
        .set({ status: "REJECTED", updatedAt: new Date() })
        .where(inArray(deliveryOffers.id, driverOffers.map(o => o.id)));

      notifyUser(
        driverId,
        "OFFER_REJECTED",
        "تم رفض عرضك",
        "تم رفض عرضك للتوصيل من قِبل العميل",
        { orderId }
      ).catch(console.error);

      return { success: true };
    });
  }

  /**
   * Customer counters a driver's offer for ALL sub-orders of an order.
   */
  async customerCounterOrderOffer(orderId: string, driverId: string, customerId: string, counterFee: number) {
    if (counterFee <= 0) throw new Error("COUNTER_FEE_MUST_BE_POSITIVE");

    return await db.transaction(async (tx) => {
      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, orderId));
      if (!parentOrder || parentOrder.customerId !== customerId) throw new Error("UNAUTHORIZED");

      const orderSubOrders = await tx.select({ id: subOrders.id }).from(subOrders).where(eq(subOrders.orderId, orderId));
      const subOrderIds = orderSubOrders.map(s => s.id);

      const driverOffers = await tx
        .select()
        .from(deliveryOffers)
        .where(and(
          eq(deliveryOffers.driverId, driverId),
          inArray(deliveryOffers.subOrderId, subOrderIds),
          eq(deliveryOffers.status, "PENDING")
        ))
        .for("update");

      if (driverOffers.length === 0) throw new Error("OFFER_NOT_AVAILABLE");

      // Validate counter fee against the representative offer
      if (!money.isLessThan(counterFee, driverOffers[0].offeredFee)) throw new Error("COUNTER_MUST_BE_LOWER");

      await tx.update(deliveryOffers)
        .set({ status: "COUNTERED", counterOfferedFee: counterFee.toFixed(2), updatedAt: new Date() })
        .where(inArray(deliveryOffers.id, driverOffers.map(o => o.id)));

      await auditService.logEvent({
        actionType: "DELIVERY_OFFER_COUNTERED",
        entityType: "delivery_offer",
        entityId: orderId,
        performedByUserId: customerId,
        performedByRole: "CUSTOMER",
        newValue: { counterFee, originalFee: driverOffers[0].offeredFee }
      });

      notifyUser(
        driverId,
        "OFFER_COUNTERED",
        "عرض مضاد",
        `قدّم العميل عرضاً مضاداً بمبلغ ${counterFee} جنيه`,
        { orderId, counterFee, originalFee: driverOffers[0].offeredFee }
      ).catch(console.error);

      return { success: true };
    });
  }

  /**
   * Driver accepts the customer's counter-offer for ALL sub-orders of an order.
   */
  async driverAcceptOrderCounterOffer(orderId: string, driverId: string) {
    return await db.transaction(async (tx) => {
      const [parentOrder] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!parentOrder) throw new Error("ORDER_NOT_FOUND");

      const orderSubOrders = await tx
        .select()
        .from(subOrders)
        .where(and(
          eq(subOrders.orderId, orderId),
          eq(subOrders.status, "ACCEPTED"),
          isNull(subOrders.assignedDriverId)
        ))
        .for("update");

      if (orderSubOrders.length === 0) throw new Error("SUBORDER_NOT_AVAILABLE");

      const subOrderIds = orderSubOrders.map(s => s.id);

      const driverOffers = await tx
        .select()
        .from(deliveryOffers)
        .where(and(
          eq(deliveryOffers.driverId, driverId),
          inArray(deliveryOffers.subOrderId, subOrderIds),
          eq(deliveryOffers.status, "COUNTERED")
        ))
        .for("update");

      if (driverOffers.length === 0) throw new Error("OFFER_NOT_COUNTERED");

      const counterFeeStr = driverOffers[0].counterOfferedFee;
      if (!counterFeeStr) throw new Error("COUNTER_FEE_MISSING");
      const agreedFee = money.format(counterFeeStr);

      // Deduct counter fee from customer wallet
      const [customerWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, parentOrder.customerId))
        .for("update");

      if (!customerWallet) throw new Error("WALLET_NOT_FOUND");
      if (money.isLessThan(customerWallet.balance, counterFeeStr)) throw new Error("INSUFFICIENT_BALANCE");

      const newBalance = money.subtract(customerWallet.balance, counterFeeStr);
      await tx.update(wallets).set({ balance: newBalance, updatedAt: new Date() }).where(eq(wallets.id, customerWallet.id));

      await tx.insert(walletTransactions).values({
        walletId: customerWallet.id,
        type: "WITHDRAWAL",
        amount: counterFeeStr,
        relatedOrderId: orderId,
        status: "COMPLETED",
        notes: `رسوم توصيل (عرض مضاد مقبول) للطلب #${orderId.slice(0, 8)}`,
      });

      await tx.insert(ledger).values({
        referenceId: orderId,
        debitUserId: parentOrder.customerId,
        creditUserId: null,
        amount: counterFeeStr,
        type: "WITHDRAWAL",
      });

      // Assign driver to all sub-orders
      for (let i = 0; i < orderSubOrders.length; i++) {
        const sub = orderSubOrders[i];
        const feeForThisSub = i === 0 ? agreedFee : "0.00";
        await tx.update(subOrders).set({
          assignedDriverId: driverId,
          expectedDeliveryFee: feeForThisSub,
          status: "IN_TRANSIT",
          updatedAt: new Date(),
        }).where(eq(subOrders.id, sub.id));
      }

      const driverOfferIds = driverOffers.map(o => o.id);
      await tx.update(deliveryOffers).set({ status: "ACCEPTED", updatedAt: new Date() })
        .where(inArray(deliveryOffers.id, driverOfferIds));

      await tx.update(deliveryOffers).set({ status: "REJECTED", updatedAt: new Date() })
        .where(and(
          inArray(deliveryOffers.subOrderId, subOrderIds),
          not(inArray(deliveryOffers.id, driverOfferIds))
        ));

      await auditService.logEvent({
        actionType: "DELIVERY_OFFER_COUNTER_ACCEPTED_BY_DRIVER",
        entityType: "delivery_offer",
        entityId: orderId,
        performedByUserId: driverId,
        performedByRole: "DRIVER",
        newValue: { status: "ACCEPTED", agreedFee, orderId }
      });

      notifyUser(
        parentOrder.customerId,
        "OFFER_ACCEPTED",
        "السائق قبل عرضك المضاد",
        `وافق السائق على رسوم التوصيل بمبلغ ${agreedFee} جنيه وسيتوجه إليك الآن`,
        { orderId, agreedFee }
      ).catch(console.error);

      return { success: true, subOrderIds, agreedFee };
    }).then(async (result) => {
      for (const subOrderId of result.subOrderIds) {
        await deliveryOtpService.generateOtp(orderId, subOrderId).catch(console.error);
      }

      try {
        const [parentOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
        if (parentOrder) {
          const primarySubOrderId = result.subOrderIds[0];
          const existingRoom = await chatService.findRoomByReference("ORDER_DRIVER", primarySubOrderId);
          if (!existingRoom) {
            await chatService.createRoom("ORDER_DRIVER", [parentOrder.customerId, driverId], {
              referenceId: primarySubOrderId,
              title: "تنسيق التوصيل",
            });
          }
        }
      } catch {}

      return result;
    });
  }

  // Q: هل acceptTask (Legacy) آمن للاستخدام في تدفق التوصيل الحالي؟
  // A: لا — هذه الدالة تحتوي على ثغرتين هامتين رغم إصلاحات الـ status checks:
  //    1. لا تخصم رسوم التوصيل من محفظة العميل — تضع السائق في IN_TRANSIT
  //       مباشرةً دون أن تُقيّد مبلغاً مقابل رسوم التوصيل الموعودة. نتيجة ذلك:
  //       إذا رفض العميل الدفع لاحقاً أو أُلغي الطلب، لا يوجد مبلغ محجوز.
  //    2. لا تسجّل قيداً في ledger مقابل رسوم التوصيل — يُعطّل محاسبة العمولات.
  //    التدفق الصحيح هو customerAcceptOffer() التي تفعل كل ذلك بشكل صحيح.
  //    الإصلاح المؤقت: إبقاء الدالة كـ fallback طارئ فقط مع تسجيل تحذير.
  //    الإصلاح الكامل: حذف endpoint /api/delivery/suborders/:id/accept من routes.ts
  //    وتوجيه كل تدفقات القبول عبر /api/delivery/offers/:offerId/accept.
  // Legacy: driver self-accepts (kept for backward compatibility but no longer used for customer flow)
  async acceptTask(subOrderId: string, driverId: string) {
    console.warn(`[LEGACY] acceptTask called for subOrder=${subOrderId} driver=${driverId}. This bypasses delivery fee deduction. Use customerAcceptOffer flow instead.`);
    return await db.transaction(async (tx) => {
      // BUG-FIX: Missing status and approval checks — previously a driver could accept a
      // sub-order in PENDING/DELIVERED/CANCELLED state and bypass customer acceptance flow
      // (no delivery fee deducted). Also missing driver approval check.
      const [driver] = await tx.select().from(users).where(eq(users.id, driverId));
      if (!driver || !driver.isApproved) throw new Error("DRIVER_NOT_APPROVED");

      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, subOrderId)).for("update");
      if (!subOrder) throw new Error("NOT_FOUND");
      if (subOrder.status !== "ACCEPTED") throw new Error("TASK_NOT_AVAILABLE");
      if (subOrder.assignedDriverId) throw new Error("ALREADY_ASSIGNED");

      const [updatedSubOrder] = await tx
        .update(subOrders)
        .set({ 
          assignedDriverId: driverId, 
          status: "IN_TRANSIT",
          updatedAt: new Date() 
        })
        .where(eq(subOrders.id, subOrderId))
        .returning();

      await tx.update(deliveryOffers)
        .set({ status: "ACCEPTED" })
        .where(and(eq(deliveryOffers.subOrderId, subOrderId), eq(deliveryOffers.driverId, driverId)));
      
      await tx.update(deliveryOffers)
        .set({ status: "REJECTED" })
        .where(and(eq(deliveryOffers.subOrderId, subOrderId), ne(deliveryOffers.driverId, driverId)));

      return updatedSubOrder;
    }).then(async (updatedSubOrder) => {
      await deliveryOtpService.generateOtp(updatedSubOrder.orderId, subOrderId);
      return updatedSubOrder;
    });
  }
}

export const deliveryOfferService = new DeliveryOfferService();
