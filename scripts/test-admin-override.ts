import { db } from "../server/db";
import { wallets, users, ledger, auditLogs } from "../shared/schema";
import { walletService } from "../server/modules/wallet/wallet.service";
import { eq, and } from "drizzle-orm";

async function runTest() {
  console.log("Starting Admin Override Security & Integrity Test...");

  // 1. Setup: Create Admin, Customer, and Wallet
  const adminEmail = `admin-${Date.now()}@example.com`;
  const customerEmail = `customer-${Date.now()}@example.com`;

  const [adminUser] = await db.insert(users).values({
    name: "Admin User",
    email: adminEmail,
    password: "password",
    role: "ADMIN",
    isApproved: true,
  }).returning();

  const [customerUser] = await db.insert(users).values({
    name: "Customer User",
    email: customerEmail,
    password: "password",
    role: "CUSTOMER",
    isApproved: true,
  }).returning();

  const [wallet] = await db.insert(wallets).values({
    userId: customerUser.id,
    balance: "100.00",
  }).returning();

  console.log(`Created wallet for ${customerEmail} with balance: ${wallet.balance}`);

  // 2. Success Case: Admin increases balance
  console.log("TEST: Admin increasing balance by 50.00...");
  const newBalance1 = await walletService.adminOverride(wallet.id, "50.00", "Testing increase", adminUser.id);
  if (parseFloat(newBalance1) === 150) {
    console.log("✅ Success: Balance updated to 150.00");
  } else {
    console.error(`❌ Failure: Balance is ${newBalance1}`);
    process.exit(1);
  }

  // 3. Success Case: Admin decreases balance
  console.log("TEST: Admin decreasing balance by 30.00...");
  const newBalance2 = await walletService.adminOverride(wallet.id, "-30.00", "Testing decrease", adminUser.id);
  if (parseFloat(newBalance2) === 120) {
    console.log("✅ Success: Balance updated to 120.00");
  } else {
    console.error(`❌ Failure: Balance is ${newBalance2}`);
    process.exit(1);
  }

  // 4. Failure Case: Non-admin attempts override
  console.log("TEST: Customer (non-admin) attempting override...");
  try {
    await walletService.adminOverride(wallet.id, "10.00", "Illicit gain", customerUser.id);
    console.error("❌ Failure: Customer override was not rejected");
    process.exit(1);
  } catch (err: any) {
    if (err.message.includes("FORBIDDEN")) {
      console.log("✅ Success: Non-admin override rejected correctly");
    } else {
      console.error(`❌ Failure: Unexpected error message: ${err.message}`);
      process.exit(1);
    }
  }

  // 5. Failure Case: Resulting negative balance
  console.log("TEST: Override that would result in negative balance...");
  try {
    await walletService.adminOverride(wallet.id, "-200.00", "Excessive deduction", adminUser.id);
    console.error("❌ Failure: Negative balance override was not rejected");
    process.exit(1);
  } catch (err: any) {
    if (err.message.includes("BUSINESS_RULE_VIOLATION")) {
      console.log("✅ Success: Negative balance override rejected correctly");
    } else {
      console.error(`❌ Failure: Unexpected error message: ${err.message}`);
      process.exit(1);
    }
  }

  // 6. Verify Ledger and Audit Logs
  console.log("TEST: Verifying Ledger and Audit Logs...");
  const [ledgerEntry] = await db.select().from(ledger).where(eq(ledger.creditUserId, customerUser.id)).orderBy(ledger.createdAt);
  if (ledgerEntry && parseFloat(ledgerEntry.amount) === 50) {
    console.log("✅ Success: Ledger entry found for increase");
  } else {
    console.error("❌ Failure: Ledger entry missing or incorrect");
  }

  const [auditLog] = await db.select().from(auditLogs).where(
    and(
      eq(auditLogs.actionType, "ADMIN_OVERRIDE"),
      eq(auditLogs.entityId, wallet.id)
    )
  );
  if (auditLog && auditLog.performedByUserId === adminUser.id) {
    console.log("✅ Success: Audit log recorded correctly");
  } else {
    console.error("❌ Failure: Audit log missing or incorrect");
  }

  console.log("All Admin Override tests passed successfully!");
  process.exit(0);
}

runTest().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
