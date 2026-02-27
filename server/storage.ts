import { db } from "./db";
import { users, wallets, stores } from "@shared/schema";
import type { User, InsertUser, Wallet, InsertWallet } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
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
  deleteStore(id: string): Promise<boolean>;
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
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

  async deleteStore(id: string): Promise<boolean> {
    const schema = await import("@shared/schema");
    const { subOrders, products, stores, orderItems, deliveryOffers, deliveryOtps } = schema;
    
    try {
      await db.transaction(async (tx) => {
        // Delete dependent order items and offers first
        const storeSubOrders = await tx.select().from(subOrders).where(eq(subOrders.storeId, id));
        for (const so of storeSubOrders) {
          await tx.delete(orderItems).where(eq(orderItems.subOrderId, so.id));
          await tx.delete(deliveryOffers).where(eq(deliveryOffers.subOrderId, so.id));
          await tx.delete(deliveryOtps).where(eq(deliveryOtps.subOrderId, so.id));
        }
        await tx.delete(subOrders).where(eq(subOrders.storeId, id));
        await tx.delete(products).where(eq(products.storeId, id));
        await tx.delete(stores).where(eq(stores.id, id));
      });
      return true;
    } catch (err) {
      console.error("Delete store error:", err);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();