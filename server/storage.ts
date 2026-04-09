import { db } from "./db";
import { users, wallets, stores } from "@shared/schema";
import type { User, InsertUser, Wallet, InsertWallet } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  getWalletByUserId(userId: string): Promise<Wallet | undefined>;
  createStore(store: any): Promise<any>;
  getStores(): Promise<any[]>;
  getProducts(): Promise<any[]>;
  getProductsByStoreId(storeId: string): Promise<any[]>;
  getProduct(id: string): Promise<any | undefined>;
  createProduct(product: any): Promise<any>;
  updateProduct(id: string, product: any): Promise<any>;
  deleteProduct(id: string): Promise<void>;
  updateProductStock(id: string, stock: number): Promise<any>;
  // Q: هل يجب أن تُرجع deleteStore قيمة boolean أم كائن تقرير؟
  // A: كائن تقرير — التنفيذ يُرجع تقريراً مفصّلاً بعدد الموارد المحذوفة
  //    (منتجات، طلبات فرعية، عروض توصيل إلخ). الإعلان عن boolean خاطئ ويُخفي
  //    معلومات هامة عن المستدعي ويسبب خطأ في الأنواع TypeScript.
  deleteStore(id: string): Promise<{
    storeId: string;
    storeName: string;
    ownerId?: string;
    ownerEmail?: string;
    productsDeleted: number;
    subOrdersDeleted: number;
    orderItemsDeleted: number;
    deliveryOffersDeleted: number;
    deliveryOtpsDeleted: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${email})`);
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser as any).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const [wallet] = await db.insert(wallets).values(insertWallet).returning();
    return wallet;
  }

  async getWalletByUserId(userId: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    return wallet;
  }

  async createStore(insertStore: any): Promise<any> {
    const [store] = await db.insert(stores).values(insertStore).returning();
    return store;
  }

  async getStores(): Promise<any[]> {
    return await db.select().from(stores);
  }

  async getProducts(): Promise<any[]> {
    const { products } = await import("@shared/schema");
    return await db.select().from(products);
  }

  async getProductsByStoreId(storeId: string): Promise<any[]> {
    const { products } = await import("@shared/schema");
    return await db.select().from(products).where(eq(products.storeId, storeId));
  }

  async getProduct(id: string): Promise<any | undefined> {
    const { products } = await import("@shared/schema");
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(insertProduct: any): Promise<any> {
    const { products } = await import("@shared/schema");
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, updateProduct: any): Promise<any> {
    const { products } = await import("@shared/schema");
    const [product] = await db.update(products)
      .set({ ...updateProduct, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    const { products } = await import("@shared/schema");
    await db.delete(products).where(eq(products.id, id));
  }

  async updateProductStock(id: string, stock: number): Promise<any> {
    const { products } = await import("@shared/schema");
    const [product] = await db.update(products)
      .set({ stock, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteStore(id: string): Promise<any> {
    const schema = await import("@shared/schema");
    const { subOrders, products, stores, orderItems, deliveryOffers, deliveryOtps, users } = schema;
    
    return await db.transaction(async (tx) => {
      const [store] = await tx.select().from(stores).where(eq(stores.id, id));
      if (!store) throw new Error("Store not found");

      const [owner] = await tx.select().from(users).where(eq(users.id, store.ownerId));

      const report = {
        storeId: store.id,
        storeName: store.name,
        ownerId: owner?.id,
        ownerEmail: owner?.email,
        productsDeleted: 0,
        subOrdersDeleted: 0,
        orderItemsDeleted: 0,
        deliveryOffersDeleted: 0,
        deliveryOtpsDeleted: 0,
      };

      // 1. Delete dependent records for sub-orders
      const storeSubOrders = await tx.select().from(subOrders).where(eq(subOrders.storeId, id));
      report.subOrdersDeleted = storeSubOrders.length;
      
      for (const so of storeSubOrders) {
        const deletedItems = await tx.delete(orderItems).where(eq(orderItems.subOrderId, so.id)).returning();
        report.orderItemsDeleted += deletedItems.length;
        
        const deletedOffers = await tx.delete(deliveryOffers).where(eq(deliveryOffers.subOrderId, so.id)).returning();
        report.deliveryOffersDeleted += deletedOffers.length;
        
        const deletedOtps = await tx.delete(deliveryOtps).where(eq(deliveryOtps.subOrderId, so.id)).returning();
        report.deliveryOtpsDeleted += deletedOtps.length;
      }

      // 2. Delete products
      const deletedProducts = await tx.delete(products).where(eq(products.storeId, id)).returning();
      report.productsDeleted = deletedProducts.length;

      // 3. Delete sub-orders
      await tx.delete(subOrders).where(eq(subOrders.storeId, id));

      // 4. Delete store
      // BUG-FIX: Previously, this function also deleted the store owner's wallet,
      // wallet transactions, ratings, audit logs, and USER ACCOUNT — catastrophic
      // side effect. Deleting a store should NOT delete the person who owns it.
      // The owner's account, wallet, and history are preserved. Only store-specific
      // data (products, sub-orders, order items, delivery offers, OTPs) is removed.
      await tx.delete(stores).where(eq(stores.id, id));

      return report;
    });
  }
}

export const storage = new DatabaseStorage();