import { db } from "../../db";
import { deliveryOffers, subOrders, wallets, users } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";
import { auditService } from "../../services/auditService";

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

      // Update delivery offers to set this one as ACCEPTED and others as REJECTED
      await tx.update(deliveryOffers)
        .set({ status: "ACCEPTED" })
        .where(and(eq(deliveryOffers.subOrderId, subOrderId), eq(deliveryOffers.driverId, driverId)));
      
      await tx.update(deliveryOffers)
        .set({ status: "REJECTED" })
        .where(and(eq(deliveryOffers.subOrderId, subOrderId), ne(deliveryOffers.driverId, driverId)));

      await auditService.logEvent({
        actionType: "TASK_ACCEPTED",
        entityType: "suborder",
        entityId: subOrderId,
        performedByUserId: driverId,
        performedByRole: "DRIVER",
        newValue: { status: "IN_TRANSIT", assignedDriverId: driverId }
      });

      return updatedSubOrder;
    });
  }
}

export const deliveryOfferService = new DeliveryOfferService();
