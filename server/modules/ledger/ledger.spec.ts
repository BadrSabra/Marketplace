import { ledgerService } from "./ledger.service";
import { db } from "../../db";
import { subOrders, stores, users, wallets, ledger } from "@shared/schema";
import { eq } from "drizzle-orm";

async function runTests() {
  console.log("Starting Ledger & Commission Tests...");

  try {
    // 1. Setup Test Data
    const [user] = await db.insert(users).values({
      name: "Test Store Owner",
      email: `owner-${Date.now()}@test.com`,
      password: "Password123!",
      role: "STORE_OWNER",
    }).returning();

    const [driver] = await db.insert(users).values({
      name: "Test Driver",
      email: `driver-${Date.now()}@test.com`,
      password: "Password123!",
      role: "DRIVER",
    }).returning();

    await db.insert(wallets).values({ userId: user.id, balance: "0.00" });
    await db.insert(wallets).values({ userId: driver.id, balance: "0.00" });

    const [store] = await db.insert(stores).values({
      ownerId: user.id,
      name: "Test Store",
    }).returning();

    const [order] = await db.insert(subOrders).values({
      orderId: "00000000-0000-0000-0000-000000000000", // Dummy order ID if not strictly validated
      storeId: store.id,
      status: "PENDING",
      subtotal: "100.00",
      assignedDriverId: driver.id,
      expectedDeliveryFee: "10.00",
    }).returning();

    console.log("Test data setup complete.");

    // Test 1: Attempt before DELIVERED
    try {
      await ledgerService.processCommissions(order.id);
      console.error("FAIL: Test 1 - Should have failed for non-delivered status");
    } catch (e: any) {
      if (e.message === "INVALID_STATUS") console.log("PASS: Test 1 - Correctly blocked non-delivered sub-order");
      else console.error("FAIL: Test 1 - Unexpected error", e.message);
    }

    // Test 2: Admin Override
    const result2 = await ledgerService.processCommissions(order.id, true);
    if (result2.ledger_entry_ids.length === 2) console.log("PASS: Test 2 - Admin override processed successfully");
    else console.error("FAIL: Test 2 - Admin override failed");

    // Test 3: Double Processing
    try {
      await ledgerService.processCommissions(order.id, true);
      console.error("FAIL: Test 3 - Should have failed for double processing");
    } catch (e: any) {
      if (e.message === "ALREADY_PROCESSED") console.log("PASS: Test 3 - Correctly blocked double processing");
      else console.error("FAIL: Test 3 - Unexpected error", e.message);
    }

    console.log("All tests completed.");
  } catch (error) {
    console.error("Test execution failed:", error);
  }
}

// In a real environment, we'd use a test runner, but for this task we provide the spec as requested.
// runTests(); 
