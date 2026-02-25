import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users, wallets, stores } from "@shared/schema";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { authenticate, authorizeRole } from "./middleware/auth";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // --- AUTH MODULE ---
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(input.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);
      
      const { user, wallet } = await db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({
          name: input.name,
          email: input.email,
          password: hashedPassword,
          role: input.role,
          transportType: input.extra?.transportType,
          isApproved: true,
        }).returning();

        const [wallet] = await tx.insert(wallets).values({
          userId: user.id,
          balance: "0.00",
        }).returning();

        if (input.role === "STORE_OWNER" && input.extra) {
          await tx.insert(stores).values({
            ownerId: user.id,
            name: input.extra.storeName!,
            type: input.extra.storeType!,
          });
        }

        return { user, wallet };
      });
      
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
      
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ 
        token, 
        user: { ...userWithoutPassword, walletBalance: wallet.balance } 
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Registration error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const email = input.email;
      const normalizedEmail = email.toLowerCase();
      
      const user = await storage.getUserByEmail(normalizedEmail);

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(input.password, user.password);
      
      // FALLBACK: If bcrypt fails, check if it's the hex-encoded SHA-512 hash
      let finalMatch = isMatch;
      if (!isMatch && user.password.includes('.')) {
        const [hash, salt] = user.password.split('.');
        if (hash.length === 128) {
           const crypto = await import("crypto");
           const computedHash = crypto.createHmac('sha512', salt).update(input.password).digest('hex');
           finalMatch = (computedHash === hash);
           
           // If it matches via fallback, update it to a proper bcrypt hash for next time
           if (finalMatch) {
             const newHashedPassword = await bcrypt.hash(input.password, 10);
             await db.update(users).set({ password: newHashedPassword }).where(eq(users.id, user.id));
           }
        }
      }

      if (!finalMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.isApproved) {
        return res.status(403).json({ message: "Account not approved" });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

      const { password, ...userWithoutPassword } = user;
      res.status(200).json({ token, user: userWithoutPassword });
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.auth.me.path, authenticate, async (req, res) => {
    const user = await storage.getUser((req as any).user.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  // --- USERS MODULE ---
  app.get(api.users.list.path, authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    const users = await storage.getUsers();
    const cleanUsers = users.map(u => {
      const { password, ...rest } = u;
      return rest;
    });
    res.json(cleanUsers);
  });

  // --- STORES MODULE ---
  app.get(api.stores.list.path, async (req, res) => {
    const stores = await storage.getStores();
    res.json(stores);
  });

  app.post(api.stores.create.path, authenticate, authorizeRole(["ADMIN", "STORE_OWNER"]), async (req, res) => {
    try {
      const input = api.stores.create.input.parse(req.body);
      const store = await storage.createStore(input);
      res.status(201).json(store);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  // --- PRODUCTS MODULE ---
  app.get(api.products.list.path, async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  // --- ORDERS MODULE ---
  app.get("/api/orders/my-orders", authenticate, authorizeRole(["CUSTOMER"]), async (req, res) => {
    const { orderController } = await import("./modules/orders/order.controller");
    return orderController.getMyOrders(req, res);
  });

  app.get("/api/orders/my-store", authenticate, authorizeRole(["STORE_OWNER"]), async (req, res) => {
    const { orderController } = await import("./modules/orders/order.controller");
    return orderController.getMyStoreOrders(req, res);
  });

  app.get(api.orders.list.path, authenticate, async (req, res) => {
    const orders = await storage.getOrders();
    res.json(orders);
  });

  // --- WALLET MODULE ---
  app.get("/api/wallet", authenticate, async (req, res) => {
    const { walletController } = await import("./modules/wallet/wallet.controller");
    return walletController.getBalance(req, res);
  });

  app.post("/api/wallet/deposit", authenticate, authorizeRole(["CUSTOMER"]), async (req, res) => {
    const { walletController } = await import("./modules/wallet/wallet.controller");
    return walletController.deposit(req, res);
  });

  app.get("/api/wallet/deposits", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    const { walletController } = await import("./modules/wallet/wallet.controller");
    return walletController.getPendingDeposits(req, res);
  });

  app.post("/api/wallet/deposits/:id/approve", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    const { walletController } = await import("./modules/wallet/wallet.controller");
    return walletController.approveDeposit(req, res);
  });

  // --- DELIVERY MODULE ---
  app.post("/api/delivery/otp/generate", authenticate, authorizeRole(["ADMIN", "DRIVER"]), async (req, res) => {
    const { deliveryOtpController } = await import("./modules/delivery/deliveryOtp.controller");
    return deliveryOtpController.generate(req, res);
  });

  app.post("/api/delivery/otp/verify", authenticate, authorizeRole(["CUSTOMER"]), async (req, res) => {
    const { deliveryOtpController } = await import("./modules/delivery/deliveryOtp.controller");
    return deliveryOtpController.verify(req, res);
  });

  // --- ORDERS MODULE ---
  app.post("/api/orders", authenticate, authorizeRole(["CUSTOMER"]), async (req, res) => {
    const { orderController } = await import("./modules/orders/order.controller");
    return orderController.create(req, res);
  });

  app.get("/api/orders/:id", authenticate, async (req, res) => {
    const { orderController } = await import("./modules/orders/order.controller");
    return orderController.get(req, res);
  });

  app.post("/api/suborders/:id/cancel", authenticate, authorizeRole(["CUSTOMER"]), async (req, res) => {
    const { orderController } = await import("./modules/orders/order.controller");
    return orderController.cancelSubOrder(req, res);
  });

  // --- DELIVERY OFFERS ---
  app.post("/api/delivery/offers", authenticate, authorizeRole(["DRIVER"]), async (req, res) => {
    const { deliveryOfferController } = await import("./modules/delivery/deliveryOffer.controller");
    return deliveryOfferController.submit(req, res);
  });

  app.post("/api/delivery/offers/:id/accept", authenticate, authorizeRole(["CUSTOMER"]), async (req, res) => {
    const { deliveryOfferController } = await import("./modules/delivery/deliveryOffer.controller");
    return deliveryOfferController.accept(req, res);
  });

  // --- SUBORDERS STATUS MANAGEMENT ---
  app.patch("/api/suborders/:id/status", authenticate, authorizeRole(["STORE_OWNER", "DRIVER", "ADMIN"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = z.object({ status: z.string() }).parse(req.body);
      const { subOrderService } = await import("./modules/orders/suborder.service");
      
      const updatedSubOrder = await subOrderService.updateSubOrderStatus(id, status, (req as any).user);
      res.json(updatedSubOrder);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid status input" });
      }
      if (err.message === "NOT_FOUND") {
        return res.status(404).json({ message: "Sub-order not found" });
      }
      if (err.message === "INVALID_TRANSITION") {
        return res.status(400).json({ message: "Invalid status transition" });
      }
      if (err.message === "UNAUTHORIZED_OWNERSHIP" || err.message === "UNAUTHORIZED_ACTION" || err.message === "UNAUTHORIZED_ROLE") {
        return res.status(403).json({ message: "Unauthorized to perform this transition" });
      }
      console.error("SubOrder status update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- ADMIN MODULE ---
  app.patch("/api/admin/users/:id/approve", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    try {
      const { id } = req.params;
      const [user] = await db.update(users)
        .set({ isApproved: true, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const { password, ...cleanUser } = user;
      res.json(cleanUser);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/admin/reports/stats", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    try {
      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [storeCount] = await db.select({ count: sql<number>`count(*)` }).from(stores);
      const [orderCount] = await db.select({ count: sql<number>`count(*)` }).from(orders);
      const [totalRevenue] = await db.select({ sum: sql<string>`sum(total_price)` }).from(orders).where(eq(orders.paymentStatus, "PAID"));

      res.json({
        totalUsers: Number(userCount.count),
        totalStores: Number(storeCount.count),
        totalOrders: Number(orderCount.count),
        totalRevenue: totalRevenue.sum || "0.00"
      });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Ensure Admin account is ready
  async function ensureAdminAccount() {
    const adminEmail = "admin@mitgaber.com";
    const adminPassword = "Admin@123";
    const report: any = {
      adminExists: false,
      passwordStatus: "unknown",
      walletStatus: "unknown",
      finalStatus: "Initializing..."
    };

    try {
      let admin = await storage.getUserByEmail(adminEmail);
      
      if (!admin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        admin = await storage.createUser({
          name: "Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "ADMIN",
          isApproved: true
        });
        report.adminExists = true;
        report.passwordStatus = "created new admin";
      } else {
        report.adminExists = true;
        const isBcrypt = admin.password.startsWith("$2");
        if (!isBcrypt) {
          const hashedPassword = await bcrypt.hash(adminPassword, 10);
          await db.update(users).set({ password: hashedPassword }).where(eq(users.id, admin.id));
          report.passwordStatus = "updated to bcrypt";
          console.log("Admin password hash updated to bcrypt.");
        } else {
          report.passwordStatus = "hashed with bcrypt";
        }
      }

      const wallet = await storage.getWalletByUserId(admin.id);
      if (!wallet) {
        await storage.createWallet({
          userId: admin.id,
          balance: "0.00"
        });
        report.walletStatus = "created";
        console.log("Wallet created for Admin.");
      } else {
        report.walletStatus = "exists";
      }

      report.finalStatus = "Admin account ready for login";
      console.log("Admin Health Report:", JSON.stringify(report, null, 2));
    } catch (err) {
      console.error("Failed to ensure admin account:", err);
    }
  }

  // Seed data function
  async function seedDatabase() {
    try {
      const users = await storage.getUsers();
      if (users.length === 0) {
        const hashedPassword = await bcrypt.hash("password123", 10);
        const admin = await storage.createUser({ name: "Admin User", email: "admin@example.com", password: hashedPassword, phone: "123456789", role: "ADMIN", isApproved: true });
        const customer = await storage.createUser({ name: "Normal Customer", email: "customer@example.com", password: hashedPassword, phone: "987654321", role: "CUSTOMER", isApproved: true });
        const storeOwner = await storage.createUser({ name: "Store Owner", email: "owner@example.com", password: hashedPassword, phone: "555555555", role: "STORE_OWNER", isApproved: true });
        const driver = await storage.createUser({ name: "Delivery Driver", email: "driver@example.com", password: hashedPassword, phone: "444444444", role: "DRIVER", isApproved: true });
        
        // Create wallets for seeded users
        const { walletService } = await import("./modules/wallet/wallet.service");
        await walletService.getOrCreateWallet(admin.id);
        await walletService.getOrCreateWallet(customer.id);
        await walletService.getOrCreateWallet(storeOwner.id);
        await walletService.getOrCreateWallet(driver.id);

        const latestStoreOwner = await storage.getUserByEmail("owner@example.com");
        if(latestStoreOwner) {
          await storage.createStore({ ownerId: latestStoreOwner.id, name: "Gaber Market", locationText: "Mit Gaber Square", description: "The best local market" });
        }
        console.log("Database seeded successfully");
      }
    } catch (err) {
      console.error("Failed to seed database:", err);
    }
  }

  // Attempt to seed data
  await ensureAdminAccount();
  seedDatabase();

  return httpServer;
}