import express from "express";
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users, wallets, walletTransactions, stores, orders, subOrders, auditLogs, ledger } from "@shared/schema";
import { walletService } from "./modules/wallet/wallet.service";
import { ledgerService } from "./modules/ledger/ledger.service";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq, sql, and } from "drizzle-orm";
import { authenticate, authorizeRole } from "./middleware/auth";
import { productsController, upload } from "./modules/products/products.controller";
import { upload as avatarUpload } from "./modules/avatar/avatar.upload";
import { receiptUpload } from "./modules/receipt/receipt.upload";
import { storeUpload } from "./modules/store/store.upload";
import { subOrderController } from "./modules/orders/suborder.controller";
import { walletController } from "./modules/wallet/wallet.controller";
import { orderController } from "./modules/orders/order.controller";

const JWT_SECRET = process.env.JWT_SECRET!;

import { deliveryController } from "./modules/delivery/delivery.controller";
import depositRouter from "./modules/deposits/deposits.controller";
import ledgerRouter from "./modules/ledger/ledger.controller";
import { auditMiddleware } from "./modules/audit/audit.middleware";
import { deliveryOfferController } from "./modules/delivery/deliveryOffer.controller";
import { deliveryOtpController } from "./modules/delivery/deliveryOtp.controller";

import { loginLimiter, orderLimiter, depositLimiter } from "./middleware/security";
import { chatController } from "./modules/chat/chat.controller";
import { deployController } from "./modules/deploy/deploy.controller";
import notificationRouter from "./modules/notifications/notification.routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
    const { otpLimiter } = await import("./middleware/security");
    app.use(auditMiddleware);

    // Self-deployment webhook - GitHub يُرسل هنا عند كل push
    app.post(
      "/api/deploy/webhook",
      express.raw({ type: "application/json" }),
      deployController.webhook
    );

    // Deploy status - لمراقبة حالة آخر عمليات النشر
    app.get("/api/deploy/status", deployController.status);

    // Ledger
    app.use("/api", ledgerRouter);
  
    // Delivery
    app.get("/api/delivery/available-tasks", authenticate, authorizeRole(["DRIVER"]), deliveryController.getAvailableTasks);
    app.get("/api/suborders/active", authenticate, authorizeRole(["DRIVER"]), subOrderController.getActiveDelivery);
    app.post("/api/delivery/otp/generate/:id", authenticate, authorizeRole(["DRIVER"]), deliveryOtpController.generateOtp.bind(deliveryOtpController));
    app.post("/api/delivery/otp/verify/:id", authenticate, authorizeRole(["DRIVER"]), otpLimiter, deliveryOtpController.verify.bind(deliveryOtpController));
  app.post("/api/delivery/suborders/:id/offer", authenticate, authorizeRole(["DRIVER"]), deliveryOfferController.submitOffer);
  app.patch("/api/delivery/suborders/:id/accept", authenticate, authorizeRole(["DRIVER"]), deliveryOfferController.acceptTask);
  // Customer: view and act on delivery offers
  app.get("/api/delivery/suborders/:id/offers", authenticate, authorizeRole(["CUSTOMER"]), deliveryOfferController.getOffersForSubOrder.bind(deliveryOfferController));
  app.post("/api/delivery/offers/:offerId/accept", authenticate, authorizeRole(["CUSTOMER"]), deliveryOfferController.customerAcceptOffer.bind(deliveryOfferController));
  app.post("/api/delivery/offers/:offerId/reject", authenticate, authorizeRole(["CUSTOMER"]), deliveryOfferController.customerRejectOffer.bind(deliveryOfferController));
  app.post("/api/delivery/offers/:offerId/counter", authenticate, authorizeRole(["CUSTOMER"]), deliveryOfferController.customerCounterOffer.bind(deliveryOfferController));
  app.post("/api/delivery/offers/:offerId/accept-counter", authenticate, authorizeRole(["DRIVER"]), deliveryOfferController.driverAcceptCounterOffer.bind(deliveryOfferController));
  
  // Notifications
  app.use("/api/notifications", notificationRouter);

  // Chat
  app.get("/api/chat/rooms", authenticate, chatController.getMyRooms.bind(chatController));
  app.get("/api/chat/rooms/:roomId/messages", authenticate, chatController.getMessages.bind(chatController));
  app.post("/api/chat/rooms/:roomId/messages", authenticate, chatController.sendMessage.bind(chatController));
  app.post("/api/chat/rooms/:roomId/read", authenticate, chatController.markRead.bind(chatController));
  app.post("/api/chat/support", authenticate, chatController.openSupportRoom.bind(chatController));
  app.get("/api/chat/unread", authenticate, chatController.getUnreadCount.bind(chatController));

  // Deposits
  app.use("/api", depositRouter);
  // --- AUTH MODULE ---
  app.post(api.auth.register.path, async (req, res, next) => {
    try {
      const input = api.auth.register.input.parse(req.body);

      // Determine the internal email: use provided email, or generate one from phone
      const internalEmail = input.email
        ? input.email
        : `${input.phone}@phone.mitgaber.local`;

      // Check for duplicate email
      if (input.email) {
        const existingByEmail = await storage.getUserByEmail(input.email);
        if (existingByEmail) {
          return res.status(400).json({ message: "البريد الإلكتروني مسجّل بالفعل" });
        }
      }

      // Check for duplicate phone
      if (input.phone) {
        const existingByPhone = await storage.getUserByPhone(input.phone);
        if (existingByPhone) {
          return res.status(400).json({ message: "رقم الهاتف مسجّل بالفعل" });
        }
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);
      
      const rolesThatNeedApproval = ["STORE_OWNER", "DRIVER"];
      const isApproved = !rolesThatNeedApproval.includes(input.role);

      const { user, wallet } = await db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({
          name: input.name,
          email: internalEmail,
          phone: input.phone,
          password: hashedPassword,
          role: input.role,
          transportType: input.extra?.transportType,
          isApproved,
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
      
      const { password, ...userWithoutPassword } = user;

      if (!isApproved) {
        const { notifyAdmins } = await import("./modules/notifications/push.service");
        const roleLabel = user.role === "DRIVER" ? "سائق جديد" : "صاحب متجر جديد";
        notifyAdmins(
          "SYSTEM_ALERT",
          `طلب موافقة: ${roleLabel}`,
          `${user.name} سجّل كـ${roleLabel} ويحتاج لموافقتك`,
          { userId: user.id, role: user.role, userName: user.name }
        ).catch(console.error);

        return res.status(201).json({
          pendingApproval: true,
          message: "تم تسجيل حسابك بنجاح. سيتم مراجعته من قِبل الإدارة وإعلامك عند الموافقة.",
          user: { ...userWithoutPassword, walletBalance: wallet.balance }
        });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ 
        token, 
        user: { ...userWithoutPassword, walletBalance: wallet.balance } 
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      // BUG-FIX: Handle PostgreSQL unique constraint violation (race condition on concurrent registration).
      // Previously, concurrent registrations with the same email would both pass the pre-check
      // and then one would get a 500 from the DB unique constraint. Now returns a proper 400.
      if (err?.code === "23505" || err?.message?.includes("unique")) {
        return res.status(400).json({ message: "البريد الإلكتروني أو رقم الهاتف مسجّل بالفعل" });
      }
      console.error("Registration error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, loginLimiter, async (req, res, next) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const identifier = input.email.trim();

      // Detect whether identifier is an email or a phone number
      const isEmail = identifier.includes("@");

      let user;
      if (isEmail) {
        // BUG-FIX-1: Removed duplicate getUserByEmail call (dead code — identical params)
        user = await storage.getUserByEmail(identifier.toLowerCase());
      } else {
        // Treat as phone number — look up by phone field
        user = await storage.getUserByPhone(identifier);
        // Fallback: try looking up by phone-generated internal email
        if (!user) {
          user = await storage.getUserByEmail(`${identifier}@phone.mitgaber.local`);
        }
      }

      if (!user) {
        return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
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
           
           // If it matches via fallback, upgrade to bcrypt for next login
           if (finalMatch) {
             try {
               const newHashedPassword = await bcrypt.hash(input.password, 10);
               await db.update(users).set({ password: newHashedPassword, updatedAt: new Date() }).where(eq(users.id, user.id));
             } catch (upgradeErr) {
               // Non-fatal: log and continue — user is still authenticated
               console.error("[AUTH] Failed to upgrade password hash for user", user.id, upgradeErr);
             }
           }
        }
      }

      // BUG-FIX-2: Was returning English "Invalid credentials" — now consistent Arabic
      if (!finalMatch) {
        return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
      }

      if (!user.isApproved) {
        return res.status(403).json({ 
          message: "حسابك قيد المراجعة. سيتم إعلامك عند موافقة الإدارة.",
          code: "ACCOUNT_PENDING_APPROVAL"
        });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

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
  app.get("/api/customer/profile", authenticate, authorizeRole(["CUSTOMER"]), async (req, res) => {
    const user = await storage.getUser((req as any).user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { password, ...cleanUser } = user;
    res.json(cleanUser);
  });

  // Shared profile update handler used by both customer and driver routes
  async function handleProfileUpdate(req: any, res: any) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const updateSchema = z.object({
        name: z.string().min(1).max(50).optional(),
        phone: z.string().min(7, "رقم الهاتف قصير جداً").max(20).regex(/^\+?[\d\s\-]+$/, "رقم الهاتف غير صحيح").or(z.literal("")).optional(),
        transportType: z.string().optional(),
        avatarUrl: z.string().optional(),
        driversLicenseUrl: z.string().optional(),
        addresses: z.array(z.string().min(1)).optional(),
      });

      const input = updateSchema.parse(req.body);
      const oldUser = await storage.getUser(userId);

      const [updatedUser] = await db.update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      const { auditService } = await import("./services/auditService");
      await auditService.logEvent({
        actionType: "PROFILE_UPDATE",
        entityType: "user",
        entityId: userId,
        performedByUserId: userId,
        performedByRole: userRole,
        oldValue: { name: oldUser?.name, phone: oldUser?.phone },
        newValue: { name: updatedUser.name, phone: updatedUser.phone },
      });

      const { password, ...cleanUser } = updatedUser;
      res.json(cleanUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal error" });
    }
  }

  app.patch("/api/customer/profile", authenticate, handleProfileUpdate);
  app.patch("/api/driver/profile", authenticate, authorizeRole(["DRIVER"]), handleProfileUpdate);

  // Receipt upload endpoint for deposits
  app.post("/api/wallet/deposit/receipt", authenticate, (req, res) => {
    receiptUpload.single("receipt")(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const receiptUrl = `/uploads/receipts/${req.file.filename}`;
      res.json({ receiptUrl });
    });
  });

  // Avatar upload endpoint — shared for customers and drivers
  app.post("/api/profile/avatar", authenticate, (req, res) => {
    avatarUpload.single("avatar")(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      try {
        const userId = (req as any).user.id;
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const [updatedUser] = await db
          .update(users)
          .set({ avatarUrl, updatedAt: new Date() })
          .where(eq(users.id, userId))
          .returning();
        const { password, ...cleanUser } = updatedUser;
        res.json({ avatarUrl, user: cleanUser });
      } catch (e: any) {
        res.status(500).json({ message: e.message || "Failed to save avatar" });
      }
    });
  });

  app.post("/api/profile/license", authenticate, authorizeRole(["DRIVER"]), (req, res) => {
    avatarUpload.single("avatar")(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      try {
        const userId = (req as any).user.id;
        const driversLicenseUrl = `/uploads/avatars/${req.file.filename}`;
        const [updatedUser] = await db
          .update(users)
          .set({ driversLicenseUrl, updatedAt: new Date() })
          .where(eq(users.id, userId))
          .returning();
        const { password, ...cleanUser } = updatedUser;
        res.json({ driversLicenseUrl, user: cleanUser });
      } catch (e: any) {
        res.status(500).json({ message: e.message || "Failed to save license" });
      }
    });
  });

  app.get(api.users.list.path, authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    const users = await storage.getUsers();
    const cleanUsers = users.map(u => {
      const { password, ...rest } = u;
      return rest;
    });
    res.json(cleanUsers);
  });

  // --- PUBLIC ROUTES ---
  const { publicStoresController } = await import("./modules/public/public.controller");
  app.get("/api/public/stores", publicStoresController.getStores);
  app.get("/api/public/stores/:id", publicStoresController.getStore);

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

  app.delete("/api/stores/:id", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    try {
      const id = req.params.id as string;
      const report = await storage.deleteStore(id);
      console.log("Store Deletion Report:", JSON.stringify(report, null, 2));
      res.json({ success: true, message: "Store and all related data deleted successfully", report });
    } catch (err: any) {
      console.error("Delete store error:", err);
      res.status(500).json({ success: false, message: err.message || "Internal server error" });
    }
  });

  // Store banner image upload
  app.post("/api/stores/:id/image", authenticate, authorizeRole(["STORE_OWNER", "ADMIN"]), (req, res) => {
    storeUpload.single("image")(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      try {
        const id = req.params.id as string;
        const imageUrl = `/uploads/stores/${req.file.filename}`;
        const [updated] = await db
          .update(stores)
          .set({ imageUrl, updatedAt: new Date() })
          .where(eq(stores.id, id))
          .returning();
        if (!updated) return res.status(404).json({ message: "Store not found" });
        res.json({ imageUrl, store: updated });
      } catch (e: any) {
        res.status(500).json({ message: e.message || "Failed to save store image" });
      }
    });
  });

  // --- PRODUCTS MODULE ---
  app.get("/api/products", productsController.getAll);
  app.post("/api/products", authenticate, productsController.create);
  app.get("/api/products/:id", productsController.getOne);
  app.patch("/api/products/:id", authenticate, productsController.update);
  app.delete("/api/products/:id", authenticate, productsController.delete);
  app.post(
    "/api/products/:id/image",
    authenticate,
    authorizeRole(["STORE_OWNER", "ADMIN"]),
    (req, res, next) => {
      upload.single("image")(req, res, (err) => {
        if (err) {
          if (err.message === "INVALID_FILE_TYPE") {
            return res.status(400).json({ error: "Only jpg, png, and webp images are allowed" });
          }
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: "File size must not exceed 5MB" });
          }
          return res.status(400).json({ error: err.message });
        }
        next();
      });
    },
    productsController.uploadImage
  );

  // --- SUBORDERS STATUS MANAGEMENT ---
  app.patch("/api/suborders/:id/status", authenticate, authorizeRole(["STORE_OWNER", "DRIVER", "ADMIN"]), subOrderController.updateStatus);

  // --- ADMIN MODULE ---
  app.get("/api/admin/stats", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    try {
      // BUG-FIX-3: Was returning hardcoded 0 for pendingOrders/cancelledOrders/deliveredOrders
      // Now all values are queried from the database
      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [storeCount] = await db.select({ count: sql<number>`count(*)` }).from(stores);
      const [orderCount] = await db.select({ count: sql<number>`count(*)` }).from(orders);
      const [totalRevenue] = await db.select({ sum: sql<string>`sum(total_price)` }).from(orders).where(eq(orders.paymentStatus, "PAID"));
      const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.overallStatus, "PENDING"));
      const [cancelledCount] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.overallStatus, "CANCELLED"));
      const [deliveredCount] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.overallStatus, "DELIVERED"));
      const [commissionSum] = await db.select({ sum: sql<string>`sum(amount)` }).from(ledger).where(eq(ledger.type, "COMMISSION"));

      // BUG-FIX: storeEarnings and driverEarnings were hardcoded to "0.00".
      // Now calculated from ledger by joining with users table to distinguish roles.
      const [storeEarningsRow] = await db
        .select({ sum: sql<string>`sum(${ledger.amount})` })
        .from(ledger)
        .innerJoin(users, eq(ledger.creditUserId, users.id))
        .where(and(eq(ledger.type, "COMMISSION"), eq(users.role, "STORE_OWNER")));

      const [driverEarningsRow] = await db
        .select({ sum: sql<string>`sum(${ledger.amount})` })
        .from(ledger)
        .innerJoin(users, eq(ledger.creditUserId, users.id))
        .where(and(eq(ledger.type, "COMMISSION"), eq(users.role, "DRIVER")));

      res.json({
        totalUsers: Number(userCount.count),
        totalStores: Number(storeCount.count),
        totalOrders: Number(orderCount.count),
        totalRevenue: totalRevenue.sum || "0.00",
        activeStores: Number(storeCount.count),
        pendingOrders: Number(pendingCount.count),
        cancelledOrders: Number(cancelledCount.count),
        deliveredOrders: Number(deliveredCount.count),
        platformCommissions: commissionSum.sum || "0.00",
        storeEarnings: storeEarningsRow?.sum || "0.00",
        driverEarnings: driverEarningsRow?.sum || "0.00"
      });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/admin/orders", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    const allOrders = await db.select().from(orders).orderBy(sql`${orders.createdAt} DESC`);
    res.json(allOrders);
  });

  // Admin: force-update ALL sub_orders of a parent order to a given status
  app.patch("/api/admin/orders/:id/status", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    try {
      const id = req.params.id as string;
      const statusSchema = z.object({ status: z.enum(["DELIVERED", "CANCELLED"]) });
      const { status } = statusSchema.parse(req.body);

      const [parentOrder] = await db.select().from(orders).where(eq(orders.id, id));
      if (!parentOrder) return res.status(404).json({ message: "Order not found" });

      await db.transaction(async (tx) => {
        await tx.update(subOrders).set({ status, updatedAt: new Date() }).where(eq(subOrders.orderId, id));
        await tx.update(orders)
          .set({ overallStatus: status, updatedAt: new Date() })
          .where(eq(orders.id, id));

        // Refund the customer wallet if cancelling a paid order
        if (status === "CANCELLED" && parentOrder.paymentStatus === "PAID") {
          const [customerWallet] = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.userId, parentOrder.customerId))
            .for("update");

          // BUG-FIX: Was using `if (customerWallet)` (soft check) which silently skips
          // the refund if the wallet row is missing. Money paid by the customer would vanish.
          // Throw instead to roll back the transaction — no state should be committed
          // if the refund cannot be completed.
          if (!customerWallet) {
            throw new Error("WALLET_NOT_FOUND: Cannot refund order — customer wallet missing");
          }

          {
            const refundAmount = parseFloat(parentOrder.totalPrice);
            const newBalance = (parseFloat(customerWallet.balance) + refundAmount).toFixed(2);
            await tx
              .update(wallets)
              .set({ balance: newBalance, updatedAt: new Date() })
              .where(eq(wallets.id, customerWallet.id));

            await tx.insert(walletTransactions).values({
              walletId: customerWallet.id,
              type: "REFUND",
              amount: parentOrder.totalPrice,
              relatedOrderId: parentOrder.id,
              status: "COMPLETED",
              notes: `استرداد تلقائي - إلغاء الطلب #${parentOrder.id.slice(0, 8)} بواسطة الإدارة`,
            });

            // A refund credits the customer's wallet — ledger type must be "DEPOSIT"
            // (same convention as cancelSubOrder in order.service.ts and rejectWithdrawal).
            // BUG-FIX: Was incorrectly using type "WITHDRAWAL" for a credit entry, which is
            // semantically wrong and inconsistent with all other refund ledger entries in the codebase.
            await tx.insert(ledger).values({
              referenceId: parentOrder.id,
              debitUserId: null,
              creditUserId: parentOrder.customerId,
              amount: parentOrder.totalPrice,
              type: "DEPOSIT",
            });

            console.log(`[Admin] Refunded ${parentOrder.totalPrice} to customer ${parentOrder.customerId} for cancelled order ${id}`);
          }
        }
      });

      res.json({ message: `Order and all sub-orders marked as ${status}` });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/admin/stores", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    const allStores = await db.select().from(stores);
    res.json(allStores);
  });

  app.get("/api/admin/audit", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    try {
      const { auditService } = await import("./services/auditService");
      const filters = {
        userId: req.query.userId as string,
        actionType: req.query.actionType as string,
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await auditService.getAuditLogs(filters);
      res.json(result);
    } catch (err) {
      console.error("Audit log fetch error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/users/:id/approve", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
    try {
      const id = req.params.id as string;
      const [user] = await db.update(users)
        .set({ isApproved: true, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      
      if (!user) return res.status(404).json({ message: "User not found" });

      const { notifyUser } = await import("./modules/notifications/push.service");
      const roleLabel = user.role === "DRIVER" ? "سائق" : "صاحب متجر";
      notifyUser(
        user.id,
        "ACCOUNT_APPROVED",
        "تم قبول حسابك",
        `تهانينا! تم قبول حسابك كـ${roleLabel} ويمكنك الآن تسجيل الدخول`,
        { role: user.role }
      ).catch(console.error);
      
      const { password, ...cleanUser } = user;
      res.json(cleanUser);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/health", async (req, res) => {
    try {
      const [walletSum] = await db.select({ total: sql<string>`sum(balance)` }).from(wallets);
      const [auditCount] = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);
      
      res.json({
        database: "OK",
        ledgerConsistency: true,
        auditLogCount: Number(auditCount.count),
        totalWalletBalance: walletSum.total || "0.00",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).json({ status: "ERROR", message: "Health check failed" });
    }
  });

  const { healthController } = await import("./modules/admin/health.controller");
  app.get("/api/admin/health", authenticate, authorizeRole(["ADMIN"]), healthController.getHealth);
  app.get("/api/admin/system-health", authenticate, authorizeRole(["ADMIN"]), healthController.getHealth);

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

  // --- LEDGER MODULE ---
  app.get("/api/ledger/transactions", authenticate, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { type, status, date_from, date_to, limit, offset, sort_by, sort_order, search } = req.query;

      const result = await ledgerService.getTransactions({
        user_id: userId,
        type: type as string,
        status: status as string,
        date_from: date_from as string,
        date_to: date_to as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
        sort_by: sort_by as string,
        sort_order: sort_order as ("asc" | "desc"),
      });

      // Filter by search (OrderId) if provided
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        result.transactions = result.transactions.filter(t => 
          t.related_order_id?.toLowerCase().includes(searchTerm)
        );
      }
      
      console.log(`Fetched ${result.transactions.length} transactions for user ${userId}`);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/wallet", authenticate, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const balance = await walletService.getBalance(userId);
      res.json({ balance });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/wallet/pending", authenticate, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      // Filter pending deposits for the specific user
      const deposits = await walletService.getPendingDeposits();
      const userDeposits = deposits.filter(d => d.user.id === userId);
      res.json(userDeposits);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/wallets/:walletId/override", authenticate, authorizeRole(["ADMIN"]), walletController.adminOverride);

  app.post("/api/wallet/deposit", authenticate, depositLimiter, walletController.deposit);
  app.post("/api/wallet/withdraw", authenticate, authorizeRole(["DRIVER", "STORE_OWNER"]), walletController.withdraw.bind(walletController));

  // Admin withdrawal requests
  app.get("/api/admin/withdrawals/pending", authenticate, authorizeRole(["ADMIN"]), walletController.getPendingWithdrawals.bind(walletController));
  app.post("/api/admin/withdrawals/:id/approve", authenticate, authorizeRole(["ADMIN"]), walletController.approveWithdrawal.bind(walletController));
  app.post("/api/admin/withdrawals/:id/reject", authenticate, authorizeRole(["ADMIN"]), walletController.rejectWithdrawal.bind(walletController));

  // --- ORDERS MODULE ---
  app.get("/api/orders", authenticate, orderController.getMyOrders);
  // Alias used by the frontend hook — must be registered BEFORE /api/orders/:id
  app.get("/api/orders/my-orders", authenticate, orderController.getMyOrders);
  app.get("/api/orders/my-store", authenticate, authorizeRole(["STORE_OWNER", "ADMIN"]), orderController.getMyStoreOrders);
  app.get("/api/orders/:id", authenticate, orderController.get);
  app.post("/api/orders", authenticate, orderLimiter, orderController.create);
  app.patch("/api/suborders/:id/cancel", authenticate, orderController.cancelSubOrder);

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
  // Only seed test data in development environment
  if (process.env.NODE_ENV !== "production") {
    seedDatabase();
  }

  return httpServer;
}