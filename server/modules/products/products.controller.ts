import { Request, Response } from "express";
import { productsService } from "./products.service";
import { createProductSchema, updateProductSchema } from "./products.types";

export class ProductsController {
  async create(req: Request, res: Response) {
    try {
      const validated = createProductSchema.parse(req.body);
      const product = await productsService.createProduct(validated, (req as any).user);
      res.status(201).json(product);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
      if (err.message === "STORE_NOT_FOUND") return res.status(404).json({ error: "Store not found" });
      if (err.message === "UNAUTHORIZED_OWNERSHIP") return res.status(403).json({ error: "Unauthorized store ownership" });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const { store_id, category, page, limit } = req.query;
      const products = await productsService.getProducts({
        store_id: store_id as string,
        category: category as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const product = await productsService.getProductById(req.params.id);
      res.json(product);
    } catch (err: any) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Product not found" });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const validated = updateProductSchema.parse(req.body);
      const product = await productsService.updateProduct(req.params.id, validated, (req as any).user);
      res.json(product);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Product not found" });
      if (err.message === "UNAUTHORIZED_OWNERSHIP") return res.status(403).json({ error: "Unauthorized store ownership" });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await productsService.deleteProduct(req.params.id, (req as any).user);
      res.status(204).send();
    } catch (err: any) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Product not found" });
      if (err.message === "UNAUTHORIZED_OWNERSHIP") return res.status(403).json({ error: "Unauthorized store ownership" });
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const productsController = new ProductsController();
