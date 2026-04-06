import { Request, Response } from "express";
import { productsService } from "./products.service";
import { createProductSchema, updateProductSchema } from "./products.types";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const uploadDir = path.resolve("uploads/products");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("INVALID_FILE_TYPE"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

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
      console.error("[PRODUCTS] getAll error:", err?.message, err?.stack);
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

  async uploadImage(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      const imageUrl = `/uploads/products/${req.file.filename}`;
      const product = await productsService.updateProductImage(req.params.id, imageUrl, (req as any).user);
      res.json({ success: true, imageUrl, product });
    } catch (err: any) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Product not found" });
      if (err.message === "UNAUTHORIZED_OWNERSHIP") return res.status(403).json({ error: "Unauthorized store ownership" });
      if (err.message === "INVALID_FILE_TYPE") return res.status(400).json({ error: "Only jpg, png, and webp images are allowed" });
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const productsController = new ProductsController();
