import { SubOrderService } from "./suborder.service";
import { db } from "../../db";
import { subOrders, orderItems, products, users, stores } from "@shared/schema";
import { eq } from "drizzle-orm";

describe("SubOrder Stock Decrement & Validation", () => {
  let subOrderService: SubOrderService;
  let adminUser: any;
  let storeOwnerUser: any;
  let storeId: string;

  beforeEach(async () => {
    subOrderService = new SubOrderService();
    
    // Setup mock data in DB
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

    const [store] = await db.insert(stores).values({
      ownerId: owner.id,
      name: "Test Store",
      type: "Grocery"
    }).returning();
    storeId = store.id;
  });

  it("should successfully decrement stock on ACCEPTED transition", async () => {
    const [product] = await db.insert(products).values({
      storeId,
      name: "Tomato",
      price: "10.00",
      stock: 10
    }).returning();

    const [order] = await db.insert(subOrders).values({
      orderId: crypto.randomUUID(),
      storeId,
      status: "PENDING",
      subtotal: "10.00"
    }).returning();

    await db.insert(orderItems).values({
      subOrderId: order.id,
      productId: product.id,
      quantity: 5,
      priceAtOrder: "10.00"
    });

    const result = await subOrderService.updateSubOrderStatus(order.id, "ACCEPTED", storeOwnerUser);

    expect(result.status).toBe("ACCEPTED");
    expect(result.stock_updates[0].new_stock).toBe(5);

    const [updatedProduct] = await db.select().from(products).where(eq(products.id, product.id));
    expect(updatedProduct.stock).toBe(5);
  });

  it("should reject with 409 when stock is insufficient", async () => {
    const [product] = await db.insert(products).values({
      storeId,
      name: "Tomato",
      price: "10.00",
      stock: 2
    }).returning();

    const [order] = await db.insert(subOrders).values({
      orderId: crypto.randomUUID(),
      storeId,
      status: "PENDING",
      subtotal: "10.00"
    }).returning();

    await db.insert(orderItems).values({
      subOrderId: order.id,
      productId: product.id,
      quantity: 5,
      priceAtOrder: "10.00"
    });

    await expect(subOrderService.updateSubOrderStatus(order.id, "ACCEPTED", storeOwnerUser))
      .rejects.toThrow("INSUFFICIENT_STOCK");
  });

  it("should allow ADMIN override even if stock is insufficient", async () => {
    const [product] = await db.insert(products).values({
      storeId,
      name: "Tomato",
      price: "10.00",
      stock: 2
    }).returning();

    const [order] = await db.insert(subOrders).values({
      orderId: crypto.randomUUID(),
      storeId,
      status: "PENDING",
      subtotal: "10.00"
    }).returning();

    await db.insert(orderItems).values({
      subOrderId: order.id,
      productId: product.id,
      quantity: 5,
      priceAtOrder: "10.00"
    });

    const result = await subOrderService.updateSubOrderStatus(order.id, "ACCEPTED", adminUser);
    expect(result.status).toBe("ACCEPTED");
    expect(result.stock_updates[0].new_stock).toBe(-3);
  });

  it("should reject invalid quantities", async () => {
    const [product] = await db.insert(products).values({
      storeId,
      name: "Tomato",
      price: "10.00",
      stock: 10
    }).returning();

    const [order] = await db.insert(subOrders).values({
      orderId: crypto.randomUUID(),
      storeId,
      status: "PENDING",
      subtotal: "10.00"
    }).returning();

    await db.insert(orderItems).values({
      subOrderId: order.id,
      productId: product.id,
      quantity: 0,
      priceAtOrder: "10.00"
    });

    await expect(subOrderService.updateSubOrderStatus(order.id, "ACCEPTED", storeOwnerUser))
      .rejects.toThrow("INVALID_QUANTITY");
  });
});
