import { deliveryOtpService } from "../modules/delivery/deliveryOtp.service";
import { db } from "../db";
import { deliveryOtps, orders, subOrders, users, stores } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

async function testOtpSecurity() {
  console.log("--- STARTING OTP SECURITY TESTS ---");

  try {
    const [user] = await db.select().from(users).limit(1);
    const [store] = await db.select().from(stores).limit(1);
    
    if (!user || !store) {
      console.error("Missing test data. Run seed first.");
      return;
    }

    const [order] = await db.insert(orders).values({
      customerId: user.id,
      overallStatus: "PENDING",
    }).returning();

    const [subOrder] = await db.insert(subOrders).values({
      orderId: order.id,
      storeId: store.id,
      status: "READY",
      subtotal: "100.00",
    }).returning();

    console.log("Test Order & SubOrder created.");

    console.log("\nTesting OTP Generation...");
    const otp1 = await deliveryOtpService.generateOtp(order.id, subOrder.id);
    console.log("OTP 1 Generated:", otp1);

    console.log("\nTesting Brute Force Protection (6 attempts)...");
    for (let i = 0; i < 6; i++) {
      try {
        await deliveryOtpService.verifyOtp(order.id, "000000", subOrder.id);
      } catch (err: any) {
        console.log("Attempt", i + 1, "failed as expected:", err.message);
      }
    }

    console.log("\nTesting Multiple OTPs Invalidation...");
    await deliveryOtpService.generateOtp(order.id, subOrder.id);
    await deliveryOtpService.generateOtp(order.id, subOrder.id);
    
    const records = await db.select().from(deliveryOtps).where(eq(deliveryOtps.subOrderId, subOrder.id));
    console.log("OTP Statuses (Expected: EXPIRED, EXPIRED, PENDING):", records.map(r => r.status));

    console.log("\nTesting Expiration Logic...");
    const [expiredOtpRecord] = await db.insert(deliveryOtps).values({
      orderId: order.id,
      subOrderId: subOrder.id,
      otpCode: "999999",
      status: "PENDING",
      expiresAt: new Date(Date.now() - 10000),
      attemptCount: 0
    }).returning();

    try {
      await deliveryOtpService.verifyOtp(order.id, "999999", subOrder.id);
    } catch (err: any) {
      console.log("Expired OTP failed as expected:", err.message);
    }

    console.log("\n--- OTP SECURITY TESTS COMPLETED ---");
  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    process.exit(0);
  }
}

testOtpSecurity();
