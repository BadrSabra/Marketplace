import { db } from "../../db";
import { products, stores } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { ProductDTO, CreateProductDTO, UpdateProductDTO } from "./products.types";

export class ProductsService {
  private mapToDTO(product: any): ProductDTO {
    return {
      id: product.id,
      product_id: product.id,
      storeId: product.storeId,
      store_id: product.storeId,
      name: product.name,
      price: Number(product.price),
      stock: product.stock,
      description: product.description || undefined,
      category: product.category,
      createdAt: product.createdAt?.toISOString(),
      updatedAt: product.updatedAt?.toISOString(),
      created_at: product.createdAt?.toISOString(),
      updated_at: product.updatedAt?.toISOString(),
    };
  }

  async createProduct(data: CreateProductDTO, user: any): Promise<ProductDTO> {
    const [store] = await db.select().from(stores).where(eq(stores.id, data.store_id));
    if (!store) throw new Error("STORE_NOT_FOUND");
    
    if (user.role !== "ADMIN" && store.ownerId !== user.id) {
      throw new Error("UNAUTHORIZED_OWNERSHIP");
    }

    const [product] = await db.insert(products).values({
      storeId: data.store_id,
      name: data.name,
      price: data.price.toString(),
      stock: data.stock,
      description: data.description,
      category: data.category,
    }).returning();

    console.log(`[AUDIT-PRODUCT] user=${user.id} action=CREATE product_id=${product.id} store_id=${product.storeId}`);
    return this.mapToDTO(product);
  }

  async getProducts(filters: { store_id?: string; category?: string; page?: number; limit?: number }): Promise<ProductDTO[]> {
    let query = db.select().from(products);
    
    const conditions = [];
    if (filters.store_id) conditions.push(eq(products.storeId, filters.store_id));
    if (filters.category) conditions.push(eq(products.category, filters.category));
    
    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const limit = filters.limit || 200;
    const offset = ((filters.page || 1) - 1) * limit;
    
    const results = await query.limit(limit).offset(offset);
    return results.map(this.mapToDTO);
  }

  async getProductById(id: string): Promise<ProductDTO> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) throw new Error("NOT_FOUND");
    return this.mapToDTO(product);
  }

  async updateProduct(id: string, data: UpdateProductDTO, user: any): Promise<ProductDTO> {
    return await db.transaction(async (tx) => {
      const [product] = await tx.select().from(products).where(eq(products.id, id)).for("update");
      if (!product) throw new Error("NOT_FOUND");

      const [store] = await tx.select().from(stores).where(eq(stores.id, product.storeId));
      if (user.role !== "ADMIN" && store.ownerId !== user.id) {
        throw new Error("UNAUTHORIZED_OWNERSHIP");
      }

      const updateData: any = { ...data, updatedAt: new Date() };
      if (data.price !== undefined) updateData.price = data.price.toString();

      const [updated] = await tx.update(products)
        .set(updateData)
        .where(eq(products.id, id))
        .returning();

      console.log(`[AUDIT-PRODUCT] user=${user.id} action=UPDATE product_id=${id} store_id=${product.storeId}`);
      return this.mapToDTO(updated);
    });
  }

  async deleteProduct(id: string, user: any): Promise<void> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) throw new Error("NOT_FOUND");

    const [store] = await db.select().from(stores).where(eq(stores.id, product.storeId));
    if (user.role !== "ADMIN" && store.ownerId !== user.id) {
      throw new Error("UNAUTHORIZED_OWNERSHIP");
    }

    await db.delete(products).where(eq(products.id, id));
    console.log(`[AUDIT-PRODUCT] user=${user.id} action=DELETE product_id=${id} store_id=${product.storeId}`);
  }
}

export const productsService = new ProductsService();
