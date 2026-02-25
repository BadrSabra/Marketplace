import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { db } from "./db";
import { users, wallets } from "@shared/schema";

const initialUsers = [
  {
    name: "Admin",
    email: "admin@mitgaber.com",
    password: "Admin@123",
    role: "ADMIN",
    phone: "01000000001",
  },
  {
    name: "Customer",
    email: "customer@mitgaber.com",
    password: "Cust@123",
    role: "CUSTOMER",
    phone: "01000000002",
  },
  {
    name: "Store Owner",
    email: "owner@mitgaber.com",
    password: "Store@123",
    role: "STORE_OWNER",
    phone: "01000000003",
  },
  {
    name: "Driver",
    email: "driver@mitgaber.com",
    password: "Driver@123",
    role: "DRIVER",
    phone: "01000000004",
  },
];

async function seed() {
  console.log("Starting database seeding...");

  for (const userData of initialUsers) {
    try {
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        console.log(`User already exists: ${userData.name} (${userData.role})`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Using a transaction to ensure atomicity
      await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
            role: userData.role as any,
            phone: userData.phone,
            isApproved: true,
          })
          .returning();

        console.log(`User created: ${user.name} (${user.role})`);

        const [wallet] = await tx
          .insert(wallets)
          .values({
            userId: user.id,
            balance: "0.00",
          })
          .returning();

        console.log(`Wallet created for: ${user.name} (${user.role}), balance: 0`);
      });
    } catch (error) {
      console.error(`Failed to seed user ${userData.name}:`, error);
    }
  }

  console.log("Seeding completed.");
  
  // Fetch final state for reporting
  const allUsers = await storage.getUsers();
  const report = [];
  for (const user of allUsers) {
    const wallet = await storage.getWalletByUserId(user.id);
    report.push({
      name: user.name,
      role: user.role,
      email: user.email,
      walletBalance: wallet?.balance || "0.00"
    });
  }
  
  console.log("FINAL_REPORT:" + JSON.stringify(report, null, 2));
  process.exit(0);
}

seed();
