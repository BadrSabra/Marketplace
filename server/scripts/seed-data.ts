import { db } from "../db";
import { users, wallets, stores, products, orders, subOrders, ledger, auditLogs } from "../../shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Starting seed...");
  const hashedPassword = await bcrypt.hash("password123", 10);

  // 1. Create Admin
  const [admin] = await db.insert(users).values({
    name: "Admin User",
    email: "admin@trial.com",
    password: hashedPassword,
    role: "ADMIN",
    isApproved: true,
  }).onConflictDoNothing().returning();

  // 2. Create Store Owners
  const [owner1] = await db.insert(users).values({
    name: "Store Owner 1",
    email: "owner1@trial.com",
    password: hashedPassword,
    role: "STORE_OWNER",
    isApproved: true,
  }).onConflictDoNothing().returning();

  const [owner2] = await db.insert(users).values({
    name: "Store Owner 2",
    email: "owner2@trial.com",
    password: hashedPassword,
    role: "STORE_OWNER",
    isApproved: true,
  }).onConflictDoNothing().returning();

  // 3. Create Drivers
  const [driver1] = await db.insert(users).values({
    name: "Driver 1",
    email: "driver1@trial.com",
    password: hashedPassword,
    role: "DRIVER",
    transportType: "Motorcycle",
    isApproved: true,
  }).onConflictDoNothing().returning();

  const [driver2] = await db.insert(users).values({
    name: "Driver 2",
    email: "driver2@trial.com",
    password: hashedPassword,
    role: "DRIVER",
    transportType: "Bicycle",
    isApproved: true,
  }).onConflictDoNothing().returning();

  // 4. Create Customers
  const [cust1] = await db.insert(users).values({
    name: "Customer 1",
    email: "cust1@trial.com",
    password: hashedPassword,
    role: "CUSTOMER",
    isApproved: true,
  }).onConflictDoNothing().returning();

  const [cust2] = await db.insert(users).values({
    name: "Customer 2",
    email: "cust2@trial.com",
    password: hashedPassword,
    role: "CUSTOMER",
    isApproved: true,
  }).onConflictDoNothing().returning();

  const allUsers = [admin, owner1, owner2, driver1, driver2, cust1, cust2].filter(Boolean);

  // 5. Create Wallets
  for (const user of allUsers) {
    await db.insert(wallets).values({
      userId: user.id,
      balance: "1000.00",
    }).onConflictDoNothing();
  }

  // 6. Create Stores
  if (owner1) {
    const [store1] = await db.insert(stores).values({
      ownerId: owner1.id,
      name: "Trial Store 1",
      type: "Grocery",
      locationText: "Sandbox North",
    }).returning();

    // 5 Products for Store 1
    for (let i = 1; i <= 5; i++) {
      await db.insert(products).values({
        storeId: store1.id,
        name: `Product 1-${i}`,
        price: (10 * i).toString(),
        stock: 50,
      });
    }
  }

  if (owner2) {
    const [store2] = await db.insert(stores).values({
      ownerId: owner2.id,
      name: "Trial Store 2",
      type: "Electronics",
      locationText: "Sandbox South",
    }).returning();

    // 5 Products for Store 2
    for (let i = 1; i <= 5; i++) {
      await db.insert(products).values({
        storeId: store2.id,
        name: `Product 2-${i}`,
        price: (20 * i).toString(),
        stock: 30,
      });
    }
  }

  console.log("Seed completed successfully");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
