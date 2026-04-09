import { db } from "../../db";
import { deliveryOffers, subOrders, wallets, walletTransactions, orders, users, ledger } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";
import { auditService } from "../../services/auditService";
import { deliveryOtpService } from "./deliveryOtp.service";
import { chatService } from "../chat/chat.service";
import { notifyUser } from "../notifications/push.service";

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
   * Get all actionable offers for a sub-order (for customer to view and act on)
   * Includes PENDING and COUNTERED offers
   */
  async getOffersForSubOrder(subOrderId: string) {
    const { sql: sqlExpr } = await import("drizzle-orm");
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
        sqlExpr`${deliveryOffers.status} IN ('PENDING', 'COUNTERED')`
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

      const deliveryFee = parseFloat(offer.offeredFee);

      // Deduct delivery fee from customer wallet
      const [customerWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, customerId))
        .for("update");

      if (!customerWallet) throw new Error("WALLET_NOT_FOUND");

      const currentBalance = parseFloat(customerWallet.balance);
      if (currentBalance < deliveryFee) throw new Error("INSUFFICIENT_BALANCE");

      const newBalance = (currentBalance - deliveryFee).toFixed(2);
      await tx.update(wallets)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(wallets.id, customerWallet.id));

      // Log the delivery fee deduction as a wallet transaction
      await tx.insert(walletTransactions).values({
        walletId: customerWallet.id,
        type: "WITHDRAWAL",
        amount: deliveryFee.toFixed(2),
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
        amount: deliveryFee.toFixed(2),
        type: "WITHDRAWAL",
      });

      // Update sub-order: assign driver, update expectedDeliveryFee, set IN_TRANSIT
      const [updatedSubOrder] = await tx
        .update(subOrders)
        .set({
          assignedDriverId: offer.driverId,
          expectedDeliveryFee: deliveryFee.toFixed(2),
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
      const [offer] = await tx.select().from(deliveryOffers).where(eq(deliveryOffers.id, offerId));
      if (!offer || offer.status !== "PENDING") throw new Error("OFFER_NOT_AVAILABLE");

      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, offer.subOrderId));
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
    return await db.transaction(async (tx) => {
      const [offer] = await tx.select().from(deliveryOffers).where(eq(deliveryOffers.id, offerId)).for("update");
      if (!offer || offer.status !== "PENDING") throw new Error("OFFER_NOT_AVAILABLE");

      if (counterFee >= parseFloat(offer.offeredFee)) throw new Error("COUNTER_MUST_BE_LOWER");

      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, offer.subOrderId));
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

      const agreedFee = parseFloat(offer.counterOfferedFee);

      // Deduct agreed counter fee from customer wallet
      const [customerWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, parentOrder.customerId))
        .for("update");

      if (!customerWallet) throw new Error("WALLET_NOT_FOUND");

      const currentBalance = parseFloat(customerWallet.balance);
      if (currentBalance < agreedFee) throw new Error("INSUFFICIENT_BALANCE");

      const newBalance = (currentBalance - agreedFee).toFixed(2);
      await tx.update(wallets)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(wallets.id, customerWallet.id));

      await tx.insert(walletTransactions).values({
        walletId: customerWallet.id,
        type: "WITHDRAWAL",
        amount: agreedFee.toFixed(2),
        relatedOrderId: parentOrder.id,
        status: "COMPLETED",
        notes: `رسوم توصيل - عرض مضاد مقبول #${offerId.slice(0, 8)}`,
      });

      await tx.insert(ledger).values({
        referenceId: parentOrder.id,
        debitUserId: parentOrder.customerId,
        creditUserId: null,
        amount: agreedFee.toFixed(2),
        type: "WITHDRAWAL",
      });

      // Assign driver at agreed counter fee → IN_TRANSIT
      const [updatedSubOrder] = await tx
        .update(subOrders)
        .set({
          assignedDriverId: driverId,
          expectedDeliveryFee: agreedFee.toFixed(2),
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

  // Legacy: driver self-accepts (kept for backward compatibility but no longer used for customer flow)
  async acceptTask(subOrderId: string, driverId: string) {
    return await db.transaction(async (tx) => {
      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, subOrderId)).for("update");
      if (!subOrder) throw new Error("NOT_FOUND");
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
