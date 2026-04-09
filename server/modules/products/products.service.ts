import { db } from "../../db";
import { products, stores } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { ProductDTO, CreateProductDTO, UpdateProductDTO } from "./products.types";
import { auditService } from "../../services/auditService";
import { deleteUploadedFile } from "../../storage";

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
    // Q: هل يجب إضافة ORDER BY لاستعلام المنتجات؟
    // A: نعم — PostgreSQL لا يضمن أي ترتيب ثابت بدون ORDER BY. بدونه:
    //    1. تظهر منتجات مختلفة في نفس الصفحة عند إعادة التحميل (تجربة مستخدم سيئة).
    //    2. التصفح عبر الصفحات غير موثوق: نفس المنتج قد يظهر في صفحتين مختلفتين
    //       أو يختفي بالكامل إذا تغيّر ترتيب الصفوف بين استعلامين.
    //    الإصلاح: الترتيب بـ createdAt تصاعدياً (الأقدم أولاً) لضمان ثبات الصفحات.
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
    
    // @ts-ignore
    const results = await query.orderBy(asc(products.createdAt)).limit(limit).offset(offset);
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
    // Q: ماذا يحدث إذا حاول صاحب المتجر حذف منتج موجود في طلبات نشطة؟
    // A: PostgreSQL يرفع foreign key violation (كود 23503) لأن جدول order_items
    //    يحتوي على REFERENCES products(id) بدون ON DELETE CASCADE.
    //    الـ controller القديم لم يكن يعالج هذا الخطأ، فكان يُرسل HTTP 500 مع
    //    "Internal server error" الغامضة — والمستخدم لا يعرف لماذا فشل الحذف.
    //    الإصلاح: نرمي خطأ "HAS_ACTIVE_ORDERS" من الـ service قبل أن نصل للـ DELETE،
    //    أو نتعامل مع كود PostgreSQL 23503 في الـ controller لإرسال 409 مع رسالة واضحة.
    //    اخترنا الفحص المسبق في الـ service لأنه أوضح وأكثر توقعاً.
    //
    // Q: هل يجب حذف صورة المنتج من القرص عند حذفه من DB؟
    // A: نعم — بدون حذف الملف تتراكم الصور يتيمةً في uploads/products/ إلى الأبد.
    //    الإصلاح: نُخزّن imageUrl من داخل الـ transaction (قبل الحذف) ثم نُنظّف الملف
    //    بعد اكتمال الـ transaction بنجاح. سبب التأجيل: عمليات filesystem ليست جزءاً
    //    من DB transaction ولا يمكن rollback حذف الملف؛ لو نفّذنا الحذف داخل الـ
    //    transaction وفشل شيء لاحق، سيُلغى record DB لكن الملف سيبقى محذوفاً.
    //    بالتأجيل نضمن حذف الملف فقط بعد نجاح حذف DB.
    let imageUrlToDelete: string | null | undefined;
    try {
      await db.transaction(async (tx) => {
        // BUG-FIX: Was reading product + checking ownership then deleting outside a transaction.
        // Two concurrent delete requests (or a delete + update) could both pass the ownership check
        // and then race. Now the row is locked with FOR UPDATE inside an atomic transaction.
        const [product] = await tx.select().from(products).where(eq(products.id, id)).for("update");
        if (!product) throw new Error("NOT_FOUND");

        const [store] = await tx.select().from(stores).where(eq(stores.id, product.storeId));
        if (user.role !== "ADMIN" && store.ownerId !== user.id) {
          throw new Error("UNAUTHORIZED_OWNERSHIP");
        }

        // Capture imageUrl before deletion so we can clean it up after the tx commits
        imageUrlToDelete = product.imageUrl;

        await tx.delete(products).where(eq(products.id, id));
        await auditService.logEvent({
          actionType: "DELETE_PRODUCT",
          entityType: "PRODUCT",
          entityId: id,
          performedByUserId: user.id,
          performedByRole: user.role,
          oldValue: { name: product.name, storeId: product.storeId },
        });
      });

      // Clean up the image file AFTER the transaction has committed successfully.
      // Non-blocking best-effort: a failed file delete should not roll back an already-committed DB delete.
      if (imageUrlToDelete) {
        deleteUploadedFile(imageUrlToDelete);
      }
    } catch (err: any) {
      // PostgreSQL foreign key violation — product is referenced by order_items
      if (err?.code === "23503" || err?.message?.includes("foreign key")) {
        throw new Error("HAS_ACTIVE_ORDERS");
      }
      throw err;
    }
  }

  async updateProductImage(id: string, imageUrl: string, user: any): Promise<ProductDTO> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) throw new Error("NOT_FOUND");

    const [store] = await db.select().from(stores).where(eq(stores.id, product.storeId));
    if (user.role !== "ADMIN" && store.ownerId !== user.id) {
      throw new Error("UNAUTHORIZED_OWNERSHIP");
    }

    // Q: هل يجب حذف الصورة القديمة عند استبدالها بصورة جديدة؟
    // A: نعم — بدون حذف الملف القديم، كل تحديث للصورة يترك ملفاً يتيماً في
    //    uploads/products/. بعد عشرات التحديثات يتراكم مئات الميغابايت من الصور
    //    غير المُستخدمة. الإصلاح: نحفظ URL الصورة القديمة قبل التحديث ثم نحذفها
    //    بعد نجاح التحديث في DB. التنظيف يتم بعد DB (لا قبله) لأن فشل التحديث
    //    يعني الإبقاء على الصورة القديمة صالحة وغير يتيمة.
    const oldImageUrl = product.imageUrl;

    const [updated] = await db.update(products)
      .set({ imageUrl, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    // BUG-FIX: Old image file was never cleaned up when a product image was replaced.
    // Delete the old file after the DB update succeeds. Best-effort: a filesystem error
    // should not fail the request since the DB record is already updated successfully.
    if (oldImageUrl && oldImageUrl !== imageUrl) {
      deleteUploadedFile(oldImageUrl);
    }

    await auditService.logEvent({
      actionType: "UPDATE_PRODUCT_IMAGE",
      entityType: "PRODUCT",
      entityId: id,
      performedByUserId: user.id,
      performedByRole: user.role,
      oldValue: { imageUrl: oldImageUrl },
      newValue: { imageUrl },
    });
    return this.mapToDTO(updated);
  }
}

export const productsService = new ProductsService();
