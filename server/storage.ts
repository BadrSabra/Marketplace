import { db } from "./db";
import { users, stores, products, orders, wallets, walletTransactions, subOrders, deliveryOffers, ratings } from "@shared/schema";
import type { User, InsertUser, Store, InsertStore, Product, Order } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;

  createStore(store: InsertStore): Promise<Store>;
  getStores(): Promise<Store[]>;

  getProducts(): Promise<Product[]>;
  getOrders(): Promise<Order[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createStore(insertStore: InsertStore): Promise<Store> {
    const [store] = await db.insert(stores).values(insertStore).returning();
    return store;
  }

  async getStores(): Promise<Store[]> {
    return await db.select().from(stores);
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }
}

export const storage = new DatabaseStorage();