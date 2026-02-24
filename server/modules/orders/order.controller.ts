import { Request, Response } from "express";
import { orderService } from "./order.service";
import { z } from "zod";

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().min(1)
  })).min(1)
});

export class OrderController {
  async create(req: Request, res: Response) {
    try {
      const userId = (req.user as any).id;
      const { items } = createOrderSchema.parse(req.body);
      const order = await orderService.createMultiStoreOrder(userId, items);
      res.status(201).json(order);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await orderService.getOrderWithSubOrders(id);
      res.json(order);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  async cancelSubOrder(req: Request, res: Response) {
    try {
      const userId = (req.user as any).id;
      const { id } = req.params;
      await orderService.cancelSubOrder(id, userId);
      res.json({ message: "SubOrder cancelled and refunded if applicable" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}

export const orderController = new OrderController();
