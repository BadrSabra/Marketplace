import { depositService } from "./deposits.service";
import { db } from "../../db";
import { users, wallets, ledger } from "@shared/schema";
import { deposits } from "@shared/deposits.schema";
import { eq } from "drizzle-orm";

async function runTests() {
  console.log("Starting Deposit Approval Workflow Tests...");

  try {
    // Setup
    const [admin] = await db.insert(users).values({
      name: "Admin",
      email: `admin-${Date.now()}@test.com`,
      password: "Password123!",
      role: "ADMIN",
    }).returning();

    const [customer] = await db.insert(users).values({
      name: "Customer",
      email: `cust-${Date.now()}@test.com`,
      password: "Password123!",
      role: "CUSTOMER",
    }).returning();

    await db.insert(wallets).values({ userId: customer.id, balance: "10.00" });

    const [deposit] = await db.insert(deposits).values({
      customerId: customer.id,
      amount: "50.00",
      status: "PENDING",
    }).returning();

    console.log("Test data setup complete.");

    // Test 1: Valid Approval
    const result1 = await depositService.approveDeposit(deposit.id, admin.id);
    if (result1.status === "APPROVED") {
      const [updatedWallet] = await db.select().from(wallets).where(eq(wallets.userId, customer.id));
      if (updatedWallet.balance === "60.00") {
        console.log("PASS: Test 1 - Valid approval updates status and wallet");
      } else {
        console.error("FAIL: Test 1 - Wallet balance mismatch", updatedWallet.balance);
      }
    }

    // Test 2: Double Approval
    try {
      await depositService.approveDeposit(deposit.id, admin.id);
      console.error("FAIL: Test 2 - Should have failed double approval");
    } catch (e: any) {
      if (e.message === "ALREADY_PROCESSED") console.log("PASS: Test 2 - Correctly blocked double approval");
    }

    // Test 3: Negative Amount (Validation)
    const [badDeposit] = await db.insert(deposits).values({
      customerId: customer.id,
      amount: "-10.00",
      status: "PENDING",
    }).returning();

    try {
      await depositService.approveDeposit(badDeposit.id, admin.id);
      console.error("FAIL: Test 3 - Should have failed negative amount");
    } catch (e: any) {
      if (e.message === "INVALID_AMOUNT") console.log("PASS: Test 3 - Correctly blocked negative amount");
    }

    // Test 4: Force Approval
    const result4 = await depositService.approveDeposit(badDeposit.id, admin.id, true);
    if (result4.status === "APPROVED") console.log("PASS: Test 4 - Force approval worked");

    console.log("All Deposit tests completed.");
  } catch (error) {
    console.error("Test execution failed:", error);
  }
}
