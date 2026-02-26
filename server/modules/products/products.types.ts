import { z } from "zod";

export interface ProductDTO {
  product_id: string;
  store_id: string;
  name: string;
  price: number;
  stock: number;
  description?: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export const createProductSchema = z.object({
  name: z.string().min(2).max(100),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  description: z.string().max(500).optional(),
  category: z.string().min(1),
  store_id: z.string().uuid(),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  description: z.string().max(500).optional(),
  category: z.string().min(1).optional(),
});

export type CreateProductDTO = z.infer<typeof createProductSchema>;
export type UpdateProductDTO = z.infer<typeof updateProductSchema>;
