import { db } from "../../db";
import { deliveryOffers, subOrders, orders, wallets, walletTransactions, users } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";
import { notificationService } from "../notifications/notification.service";

export class DeliveryOfferService {
  async submitOffer(subOrderId: string, driverId: string, offeredFee: string) {
    const [subOrder] = await db.select().from(subOrders).where(eq(subOrders.id, subOrderId));
    if (!subOrder) throw new Error("SubOrder not found");

    const [offer] = await db.insert(deliveryOffers).values({
      subOrderId,
      driverId,
      offeredFee,
      status: "PENDING"
    }).returning();

    // Notify driver (optional based on requirements, but good for UX)
    // Actually, task says "New Delivery Offer -> Driver notified", but usually it's the customer who gets notified of a new offer.
    // I'll stick to the task: "New Delivery Offer -> Driver notified"
    const [driver] = await db.select().from(users).where(eq(users.id, driverId));
    if (driver) {
      await notificationService.sendEmail(driver.email, "Offer Submitted", `Your offer of ${offeredFee} for sub-order ${subOrderId} has been submitted.`);
    }

    return offer;
  }

  async acceptOffer(offerId: string, customerId: string) {
    return await db.transaction(async (tx) => {
      const [offer] = await tx.select().from(deliveryOffers).where(eq(deliveryOffers.id, offerId));
      if (!offer) throw new Error("Offer not found");

      const [subOrder] = await tx.select().from(subOrders).where(eq(subOrders.id, offer.subOrderId));
      const [order] = await tx.select().from(orders).where(eq(orders.id, subOrder.orderId));
      
      if (order.customerId !== customerId) throw new Error("Unauthorized");

      // 1. Accept this offer
      await tx.update(deliveryOffers).set({ status: "ACCEPTED" }).where(eq(deliveryOffers.id, offerId));

      // 2. Reject others
      await tx.update(deliveryOffers).set({ status: "REJECTED" }).where(and(eq(deliveryOffers.subOrderId, offer.subOrderId), ne(deliveryOffers.id, offerId)));

      // 3. Hold funds for delivery fee
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, customerId));
      if (!wallet || parseFloat(wallet.balance) < parseFloat(offer.offeredFee)) {
        throw new Error("Insufficient funds for delivery fee");
      }

      await tx.update(wallets)
        .set({ balance: (parseFloat(wallet.balance) - parseFloat(offer.offeredFee)).toFixed(2) })
        .where(eq(wallets.id, wallet.id));

      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        type: "HOLD",
        amount: offer.offeredFee,
        relatedOrderId: order.id,
        status: "PENDING"
      });

      // 4. Notifications
      const [driver] = await tx.select().from(users).where(eq(users.id, offer.driverId));
      const [customer] = await tx.select().from(users).where(eq(users.id, customerId));
      if (driver) {
        await notificationService.sendEmail(driver.email, "Offer Accepted", `Your delivery offer for sub-order ${subOrder.id} has been accepted.`);
      }
      if (customer) {
        await notificationService.sendEmail(customer.email, "Offer Accepted", `You have accepted a delivery offer for sub-order ${subOrder.id}.`);
      }
    });
  }
}

export const deliveryOfferService = new DeliveryOfferService();
