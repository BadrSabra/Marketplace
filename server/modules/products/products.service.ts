import { db } from "../../db";
import { products, stores } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { ProductDTO, CreateProductDTO, UpdateProductDTO } from "./products.types";
import { auditService } from "../../services/auditService";

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
      imageUrl: product.imageUrl || null,
      createdAt: product.createdAt?.toISOString(),
      updatedAt: product.updatedAt?.toISOString(),
      created_at: product.createdAt?.toISOString(),
      updated_at: product.updatedAt?.toISOString(),
    };
  }

  async createProduct(data: CreateProductDTO, user: any): Promise<ProductDTO> {
    let storeId = data.store_id;

    // Auto-detect store from authenticated user if store_id not provided
    if (!storeId) {
      const [ownedStore] = await db.select().from(stores).where(eq(stores.ownerId, user.id)).limit(1);
      if (!ownedStore) throw new Error("STORE_NOT_FOUND");
      storeId = ownedStore.id;
    }

    const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
    if (!store) throw new Error("STORE_NOT_FOUND");
    
    if (user.role !== "ADMIN" && store.ownerId !== user.id) {
      throw new Error("UNAUTHORIZED_OWNERSHIP");
    }

    const [product] = await db.insert(products).values({
      storeId: storeId,
      name: data.name,
      price: data.price.toString(),
      stock: data.stock,
      description: data.description,
      category: data.category,
    }).returning();

    await auditService.logEvent({
      actionType: "CREATE_PRODUCT",
      entityType: "PRODUCT",
      entityId: product.id,
      performedByUserId: user.id,
      performedByRole: user.role,
      newValue: { name: product.name, price: product.price, storeId },
    });
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
    return results.map((p) => this.mapToDTO(p));
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

      await auditService.logEvent({
        actionType: "UPDATE_PRODUCT",
        entityType: "PRODUCT",
        entityId: id,
        performedByUserId: user.id,
        performedByRole: user.role,
        oldValue: { name: product.name, price: product.price },
        newValue: { ...data },
      });
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
    await auditService.logEvent({
      actionType: "DELETE_PRODUCT",
      entityType: "PRODUCT",
      entityId: id,
      performedByUserId: user.id,
      performedByRole: user.role,
      oldValue: { name: product.name, storeId: product.storeId },
    });
  }

  async updateProductImage(id: string, imageUrl: string, user: any): Promise<ProductDTO> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) throw new Error("NOT_FOUND");

    const [store] = await db.select().from(stores).where(eq(stores.id, product.storeId));
    if (user.role !== "ADMIN" && store.ownerId !== user.id) {
      throw new Error("UNAUTHORIZED_OWNERSHIP");
    }

    const [updated] = await db.update(products)
      .set({ imageUrl, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    await auditService.logEvent({
      actionType: "UPDATE_PRODUCT_IMAGE",
      entityType: "PRODUCT",
      entityId: id,
      performedByUserId: user.id,
      performedByRole: user.role,
      newValue: { imageUrl },
    });
    return this.mapToDTO(updated);
  }
}

export const productsService = new ProductsService();
