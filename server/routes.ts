import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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
      const user = await storage.createUser({ ...input, password: hashedPassword });
      
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
      
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ token, user: userWithoutPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      
      const user = await storage.getUserByEmail(input.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(input.password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
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
  seedDatabase();

  return httpServer;
}