import { DeliveryService } from "./delivery.service";
import { db } from "../../db";
import { subOrders, orders, stores, users, orderItems, products } from "@shared/schema";
import { eq } from "drizzle-orm";

describe("Delivery Module - Available Tasks", () => {
  let deliveryService: DeliveryService;
  let driverUser: any;
  let customerUser: any;
  let storeId: string;

  beforeEach(async () => {
    deliveryService = new DeliveryService();

    // Setup driver
    const [driver] = await db.insert(users).values({
      name: "Driver Jo",
      email: `driver-${Date.now()}@test.com`,
      password: "password",
      role: "DRIVER",
      isApproved: true
    }).returning();
    driverUser = driver;

    // Setup customer
    const [customer] = await db.insert(users).values({
      name: "Customer Jane",
      email: `customer-${Date.now()}@test.com`,
      password: "password",
      role: "CUSTOMER",
      isApproved: true
    }).returning();
    customerUser = customer;

    // Setup store
    const [storeOwner] = await db.insert(users).values({
      name: "Owner",
      email: `owner-${Date.now()}@test.com`,
      password: "password",
      role: "STORE_OWNER",
      isApproved: true
    }).returning();

    const [store] = await db.insert(stores).values({
      ownerId: storeOwner.id,
      name: "Fast Delivery Store",
      type: "Express"
    }).returning();
    storeId = store.id;
  });

  it("should return available tasks for an approved driver", async () => {
    const [order] = await db.insert(orders).values({
      customerId: customerUser.id,
      totalPrice: "50.00"
    }).returning();

    const [subOrder] = await db.insert(subOrders).values({
      orderId: order.id,
      storeId: storeId,
      status: "READY",
      subtotal: "50.00"
    }).returning();

    const { tasks } = await deliveryService.getAvailableTasks(driverUser.id, {});
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks.find(t => t.sub_order_id === subOrder.id)).toBeDefined();
  });

  it("should filter tasks by store_id", async () => {
    const { tasks } = await deliveryService.getAvailableTasks(driverUser.id, { store_id: storeId });
    tasks.forEach(task => {
      expect(task.store_id).toBe(storeId);
    });
  });

  it("should reject unauthorized roles", async () => {
    await expect(deliveryService.getAvailableTasks(customerUser.id, {}))
      .rejects.toThrow("UNAUTHORIZED_ROLE");
  });

  it("should return empty array if no READY tasks exist", async () => {
    // Clear or assume fresh state
    const { tasks } = await deliveryService.getAvailableTasks(driverUser.id, { store_id: crypto.randomUUID() });
    expect(tasks).toEqual([]);
  });
});
