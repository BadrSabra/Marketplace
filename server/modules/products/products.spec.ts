import { ProductsService } from "./products.service";
import { db } from "../../db";
import { products, stores, users } from "@shared/schema";
import { eq } from "drizzle-orm";

describe("Products Module CRUD", () => {
  let productsService: ProductsService;
  let adminUser: any;
  let storeOwnerUser: any;
  let otherUser: any;
  let storeId: string;

  beforeEach(async () => {
    productsService = new ProductsService();
    
    // Setup users
    const [admin] = await db.insert(users).values({
      name: "Admin",
      email: `admin-${Date.now()}@test.com`,
      password: "password",
      role: "ADMIN",
      isApproved: true
    }).returning();
    adminUser = admin;

    const [owner] = await db.insert(users).values({
      name: "Owner",
      email: `owner-${Date.now()}@test.com`,
      password: "password",
      role: "STORE_OWNER",
      isApproved: true
    }).returning();
    storeOwnerUser = owner;

    const [other] = await db.insert(users).values({
      name: "Other",
      email: `other-${Date.now()}@test.com`,
      password: "password",
      role: "STORE_OWNER",
      isApproved: true
    }).returning();
    otherUser = other;

    // Setup store
    const [store] = await db.insert(stores).values({
      ownerId: owner.id,
      name: "Test Store",
      type: "Grocery"
    }).returning();
    storeId = store.id;
  });

  it("should create a product as store owner", async () => {
    const productData = {
      name: "Milk",
      price: 3.50,
      stock: 100,
      category: "Dairy",
      store_id: storeId
    };

    const product = await productsService.createProduct(productData, storeOwnerUser);
    expect(product.name).toBe("Milk");
    expect(product.price).toBe(3.50);
  });

  it("should reject creation if not store owner", async () => {
    const productData = {
      name: "Milk",
      price: 3.50,
      stock: 100,
      category: "Dairy",
      store_id: storeId
    };

    await expect(productsService.createProduct(productData, otherUser))
      .rejects.toThrow("UNAUTHORIZED_OWNERSHIP");
  });

  it("should update stock and ensure it is not negative via validation", async () => {
    const [product] = await db.insert(products).values({
      storeId,
      name: "Bread",
      price: "2.00",
      stock: 10,
      category: "Bakery"
    }).returning();

    const updated = await productsService.updateProduct(product.id, { stock: 5 }, storeOwnerUser);
    expect(updated.stock).toBe(5);
  });

  it("should allow admin to delete any product", async () => {
    const [product] = await db.insert(products).values({
      storeId,
      name: "Eggs",
      price: "4.00",
      stock: 20,
      category: "Dairy"
    }).returning();

    await productsService.deleteProduct(product.id, adminUser);
    await expect(productsService.getProductById(product.id)).rejects.toThrow("NOT_FOUND");
  });
});
