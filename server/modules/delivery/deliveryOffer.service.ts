import { db } from "../../db";
import { deliveryOffers, subOrders, wallets, walletTransactions, orders, users } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";
import { auditService } from "../../services/auditService";
import { deliveryOtpService } from "./deliveryOtp.service";

export class DeliveryOfferService {
  async createOffer(subOrderId: string, driverId: string, data: { proposedFee: number; notes?: string }) {
    return await db.transaction(async (tx) => {
      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, subOrderId)).for("update");
      if (!subOrder || subOrder.status !== "ACCEPTED") throw new Error("TASK_NOT_AVAILABLE");

      const [existing] = await tx
        .select()
        .from(deliveryOffers)
        .where(and(eq(deliveryOffers.subOrderId, subOrderId), eq(deliveryOffers.driverId, driverId)));
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

      return offer;
    });
  }

  /**
   * Get all pending offers for a sub-order (for customer to view and accept)
   */
  async getOffersForSubOrder(subOrderId: string) {
    const offers = await db
      .select({
        id: deliveryOffers.id,
        subOrderId: deliveryOffers.subOrderId,
        driverId: deliveryOffers.driverId,
        offeredFee: deliveryOffers.offeredFee,
        status: deliveryOffers.status,
        createdAt: deliveryOffers.createdAt,
        driverName: users.name,
        driverPhone: users.phone,
        driverTransportType: users.transportType,
      })
      .from(deliveryOffers)
      .innerJoin(users, eq(deliveryOffers.driverId, users.id))
      .where(and(
        eq(deliveryOffers.subOrderId, subOrderId),
        eq(deliveryOffers.status, "PENDING")
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

      // Log the delivery fee deduction as a PENDING wallet transaction (held until delivery)
      await tx.insert(walletTransactions).values({
        walletId: customerWallet.id,
        type: "WITHDRAWAL",
        amount: deliveryFee.toFixed(2),
        relatedOrderId: parentOrder.id,
        status: "COMPLETED",
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

      return updatedSubOrder;
    }).then(async (updatedSubOrder) => {
      // Generate OTP after transaction commits
      await deliveryOtpService.generateOtp(updatedSubOrder.orderId, updatedSubOrder.id);
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

      return { success: true };
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
