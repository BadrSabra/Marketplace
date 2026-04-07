import { pgTable, text, timestamp, boolean, integer, numeric, uuid, pgEnum, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ENUMS
export const roleEnum = pgEnum("role", ["ADMIN", "CUSTOMER", "STORE_OWNER", "DRIVER"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["DEPOSIT", "WITHDRAWAL", "REFUND", "COMMISSION"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["PENDING", "COMPLETED", "FAILED"]);
export const orderStatusEnum = pgEnum("order_status", ["PENDING", "ACCEPTED", "IN_TRANSIT", "DELIVERED", "CANCELLED"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["PENDING", "ASSIGNED", "PICKED_UP", "DELIVERED"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "PAID", "REFUNDED", "FAILED"]);
export const offerStatusEnum = pgEnum("offer_status", ["PENDING", "ACCEPTED", "REJECTED", "COUNTERED"]);

// USERS
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone"),
  role: roleEnum("role").notNull().default("CUSTOMER"),
  isApproved: boolean("is_approved").notNull().default(false),
  transportType: text("transport_type"),
  avatarUrl: text("avatar_url"),
  driversLicenseUrl: text("drivers_license_url"),
  addresses: jsonb("addresses").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// WALLETS
export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// LEDGER
export const ledger = pgTable("ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  referenceId: uuid("reference_id"),
  debitUserId: uuid("debit_user_id").references(() => users.id),
  creditUserId: uuid("credit_user_id").references(() => users.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: text("type", { enum: ["DEPOSIT", "WITHDRAWAL", "COMMISSION"] }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// WALLET TRANSACTIONS
export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  relatedOrderId: uuid("related_order_id"), // Nullable initially
  receiptUrl: text("receipt_url"),
  status: transactionStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// STORES
export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type"),
  description: text("description"),
  locationText: text("location_text"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// PRODUCTS
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id").notNull().references(() => stores.id),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  category: text("category").notNull().default("General"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ORDERS
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => users.id),
  overallStatus: orderStatusEnum("overall_status").notNull().default("PENDING"),
  deliveryStatus: deliveryStatusEnum("delivery_status").notNull().default("PENDING"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDING"),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// SUB_ORDERS
export const subOrders = pgTable("sub_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  storeId: uuid("store_id").notNull().references(() => stores.id),
  status: orderStatusEnum("status").notNull().default("PENDING"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  assignedDriverId: uuid("assigned_driver_id").references(() => users.id),
  expectedDeliveryFee: numeric("expected_delivery_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ORDER_ITEMS
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  subOrderId: uuid("sub_order_id").notNull().references(() => subOrders.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  priceAtOrder: numeric("price_at_order", { precision: 10, scale: 2 }).notNull(),
});

// DELIVERY_OFFERS
export const deliveryOffers = pgTable("delivery_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  subOrderId: uuid("sub_order_id").notNull().references(() => subOrders.id),
  driverId: uuid("driver_id").notNull().references(() => users.id),
  offeredFee: numeric("offered_fee", { precision: 10, scale: 2 }).notNull(),
  status: offerStatusEnum("status").notNull().default("PENDING"),
  counterOfferedFee: numeric("counter_offered_fee", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// RATINGS
export const ratings = pgTable("ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  fromUserId: uuid("from_user_id").notNull().references(() => users.id),
  toUserId: uuid("to_user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(), // Should be 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// DELIVERY_OTPS
export const deliveryOtps = pgTable("delivery_otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  subOrderId: uuid("sub_order_id").references(() => subOrders.id),
  otpCode: text("otp_code").notNull(),
  status: text("status", { enum: ["PENDING", "VERIFIED", "EXPIRED"] }).notNull().default("PENDING"),
  attemptCount: integer("attempt_count").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    subOrderPendingIdx: index("sub_order_pending_idx").on(table.subOrderId, table.status),
  };
});

// WITHDRAWAL REQUESTS
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).notNull().default("PENDING"),
  adminNote: text("admin_note"),
  reviewedByAdminId: uuid("reviewed_by_admin_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;

// AUDIT LOGS
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  performedByUserId: uuid("performed_by_user_id").notNull().references(() => users.id),
  performedByRole: text("performed_by_role").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    entityIdIdx: index("entity_id_idx").on(table.entityId),
    performedByUserIdIdx: index("performed_by_user_id_idx").on(table.performedByUserId),
    createdAtIdx: index("created_at_idx").on(table.createdAt),
    actionTypeIdx: index("action_type_idx").on(table.actionType),
  };
});

// SUPPORT CHAT
export const supportMessages = pgTable("support_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => users.id),
  senderRole: text("sender_role").notNull(), // "CUSTOMER" | "ADMIN"
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SupportMessage = typeof supportMessages.$inferSelect;
export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({ id: true, createdAt: true });

// ZOD SCHEMAS
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({ id: true, createdAt: true });
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubOrderSchema = createInsertSchema(subOrders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDeliveryOfferSchema = createInsertSchema(deliveryOffers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRatingSchema = createInsertSchema(ratings).omit({ id: true, createdAt: true });
export const insertDeliveryOtpSchema = createInsertSchema(deliveryOtps).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });

// AUTH SCHEMAS
export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
  role: z.enum(["CUSTOMER", "STORE_OWNER", "DRIVER"]),
  extra: z.object({
    storeName: z.string().optional(),
    storeType: z.string().optional(),
    transportType: z.string().optional(),
  }).optional(),
}).refine((data) => {
  if (data.role === "STORE_OWNER") {
    return !!(data.extra?.storeName && data.extra?.storeType);
  }
  if (data.role === "DRIVER") {
    return !!(data.extra?.transportType);
  }
  return true;
}, {
  message: "Role-specific fields are required",
  path: ["extra"],
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// API TYPES
export type User = typeof users.$inferSelect;
export type Role = User["role"];
export type Wallet = typeof wallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type SubOrder = typeof subOrders.$inferSelect;
export type DeliveryOffer = typeof deliveryOffers.$inferSelect;
export type Rating = typeof ratings.$inferSelect;
export type DeliveryOtp = typeof deliveryOtps.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type LedgerTransaction = typeof ledger.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertSubOrder = z.infer<typeof insertSubOrderSchema>;
export type InsertDeliveryOffer = z.infer<typeof insertDeliveryOfferSchema>;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type InsertDeliveryOtp = z.infer<typeof insertDeliveryOtpSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type AuthResponse = { token: string; user: Omit<User, "password"> };
