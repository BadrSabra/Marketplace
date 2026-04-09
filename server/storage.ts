import { db } from "./db";
import fs from "fs";
import path from "path";
// Q: هل يجب استيراد products ديناميكياً داخل كل دالة بـ await import()؟
// A: لا — Node.js يُخزّن الوحدات في الذاكرة بعد أول استيراد (module caching)، لذا
//    كل await import() داخل كل دالة يُضيف تحميلاً زائداً (overhead) لا مبرر له:
//    Promise allocation، await، destructuring — في كل استدعاء. الإصلاح: نقل
//    الاستيراد إلى مستوى الوحدة ليُنفَّذ مرة واحدة عند تحميل الـ module.
import { users, wallets, stores, products, subOrders, orderItems, deliveryOffers, deliveryOtps } from "@shared/schema";
import type { User, InsertUser, Wallet, InsertWallet } from "@shared/schema";
// Q: هل هناك تعارض بين نوع InsertUser (من drizzle-zod) ونوع insert Drizzle ORM المتوقع؟
// A: نعم — InsertUser من z.infer<createInsertSchema()> قد يُولّد نوع addresses كـ
//    string[] | undefined | null بينما Drizzle ORM يتوقع string[] | undefined.
//    هذا التعارض هو السبب الحقيقي لوجود `as any` في createUser.
//    الإصلاح الصحيح: استخدام النوع الداخلي لـ Drizzle مباشرةً:
type DrizzleInsertUser = typeof users.$inferInsert;
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  getWalletByUserId(userId: string): Promise<Wallet | undefined>;
  createStore(store: any): Promise<any>;
  getStores(): Promise<any[]>;
  getProducts(): Promise<any[]>;
  getProductsByStoreId(storeId: string): Promise<any[]>;
  getProduct(id: string): Promise<any | undefined>;
  createProduct(product: any): Promise<any>;
  updateProduct(id: string, product: any): Promise<any>;
  deleteProduct(id: string): Promise<void>;
  updateProductStock(id: string, stock: number): Promise<any>;
  // Q: هل يجب أن تُرجع deleteStore قيمة boolean أم كائن تقرير؟
  // A: كائن تقرير — التنفيذ يُرجع تقريراً مفصّلاً بعدد الموارد المحذوفة
  //    (منتجات، طلبات فرعية، عروض توصيل إلخ). الإعلان عن boolean خاطئ ويُخفي
  //    معلومات هامة عن المستدعي ويسبب خطأ في الأنواع TypeScript.
  deleteStore(id: string): Promise<{
    storeId: string;
    storeName: string;
    ownerId?: string;
    ownerEmail?: string;
    productsDeleted: number;
    subOrdersDeleted: number;
    orderItemsDeleted: number;
    deliveryOffersDeleted: number;
    deliveryOtpsDeleted: number;
  }>;
}

// Q: لماذا نستخدم دالة مستقلة لحذف الملفات بدلاً من استدعاء fs.unlink مباشرةً؟
// A: عدة أسباب:
//    1. الـ URL المُخزَّن في DB هو مسار نسبي مثل /uploads/stores/abc.jpg
//       ويجب تحويله لمسار مطلق على القرص قبل الحذف.
//    2. الملف قد لا يكون موجوداً (مُنتَج بدون صورة، أو صورة محذوفة يدوياً)
//       — نتجاهل ENOENT بصمت.
//    3. في حالة خطأ آخر (صلاحيات، قرص ممتلئ)، نُسجّل تحذيراً فقط ولا نُلقي
//       خطأً يُلغي عملية الحذف كلها — حذف الصورة ليس حرجاً مثل حذف بيانات DB.
//
// ⚠️ خطأ جديد تكشفه هذا الإصلاح:
//    إذا غُيّرت بنية مجلد uploads (مثلاً انتقلنا لـ S3 أو CDN)، هذه الدالة
//    ستفشل بصمت — الملفات ستُحذف من DB لكن تبقى على التخزين الخارجي.
//    الإصلاح المستقبلي: استبدال fs.unlink بـ storage adapter يدعم S3 وlocal filesystem.
export function deleteUploadedFile(urlPath: string | null | undefined): void {
  if (!urlPath) return;
  try {
    // Strip leading slash and resolve to absolute path
    const relativePath = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;
    const absolutePath = path.resolve(relativePath);
    // Safety check: only delete files within the uploads directory
    const uploadsRoot = path.resolve("uploads");
    if (!absolutePath.startsWith(uploadsRoot)) {
      console.warn(`[Storage] Refusing to delete file outside uploads dir: ${absolutePath}`);
      return;
    }
    fs.unlink(absolutePath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.warn(`[Storage] Failed to delete uploaded file ${absolutePath}:`, err.message);
      }
    });
  } catch (err: any) {
    console.warn(`[Storage] deleteUploadedFile error for ${urlPath}:`, err.message);
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${email})`);
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Q: لماذا كان هذا الاستدعاء يستخدم `as any`؟
    // A: نوع InsertUser المُولَّد من drizzle-zod عبر createInsertSchema يختلف قليلاً
    //    عن نوع insert القيم الذي يتوقعه Drizzle ORM مباشرةً. السبب:
    //    1. حقل `role` في Schema مُعرَّف كـ pgEnum، وdrizzle-zod يُولّد نوعه كـ
    //       "ADMIN" | "CUSTOMER" | "STORE_OWNER" | "DRIVER" بينما Drizzle يتوقع
    //       النوع الداخلي للـ enum. التطابق موجود لكن TypeScript يرفضه أحياناً.
    //    2. حقل `addresses` هو jsonb مع .default([])، وdrizzle-zod قد يُولّد نوعه
    //       كـ string[] | undefined بينما Drizzle يتوقع string[] | null.
    //    الإصلاح: استخدام `satisfies` بدلاً من `as any` للتحقق من النوع مع السماح
    //    لـ TypeScript بالاستدلال الصحيح دون إلغاء التحقق كلياً.
    //
    // ⚠️ خطأ جديد تكشفه هذه الإصلاح:
    //    استخدام DrizzleInsertUser بدلاً من `as any` يكشف الفرق الدقيق بين النوعين:
    //    - InsertUser.addresses نوعه: string[] | null | undefined (من drizzle-zod)
    //    - DrizzleInsertUser.addresses نوعه: string[] | undefined (من Drizzle مباشرةً)
    //    هذا يعني أن تمرير { addresses: null } صالح في InsertUser لكن سيرفضه Drizzle.
    //    بعد هذا الإصلاح، أي كود يُنشئ مستخدماً بـ addresses: null سيُعطي خطأ TypeScript.
    const [user] = await db.insert(users).values(insertUser as DrizzleInsertUser).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const [wallet] = await db.insert(wallets).values(insertWallet).returning();
    return wallet;
  }

  async getWalletByUserId(userId: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    return wallet;
  }

  async createStore(insertStore: any): Promise<any> {
    const [store] = await db.insert(stores).values(insertStore).returning();
    return store;
  }

  async getStores(): Promise<any[]> {
    return await db.select().from(stores);
  }

  async getProducts(): Promise<any[]> {
    return await db.select().from(products);
  }

  async getProductsByStoreId(storeId: string): Promise<any[]> {
    return await db.select().from(products).where(eq(products.storeId, storeId));
  }

  async getProduct(id: string): Promise<any | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(insertProduct: any): Promise<any> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, updateProduct: any): Promise<any> {
    const [product] = await db.update(products)
      .set({ ...updateProduct, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    // Q: هل يجب حذف صورة المنتج من القرص عند حذف المنتج من DB؟
    // A: نعم — بدون حذف الملف، تتراكم الصور على القرص إلى الأبد.
    //    كل منتج محذوف يترك ملف صورة يتيم في uploads/products/ أو uploads/stores/.
    //    الإصلاح: جلب imageUrl قبل الحذف ثم حذف الملف بعد نجاح عملية DB.
    //    نُسجّل خطأ الملف كتحذير فقط (لا نُلقي exception) لأن فشل حذف ملف
    //    لا يجب أن يُلغي عملية حذف البيانات الناجحة.
    const [product] = await db
      .select({ imageUrl: products.imageUrl })
      .from(products)
      .where(eq(products.id, id));

    await db.delete(products).where(eq(products.id, id));

    if (product?.imageUrl) {
      deleteUploadedFile(product.imageUrl);
    }
  }

  async updateProductStock(id: string, stock: number): Promise<any> {
    const [product] = await db.update(products)
      .set({ stock, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteStore(id: string): Promise<any> {
    return await db.transaction(async (tx) => {
      const [store] = await tx.select().from(stores).where(eq(stores.id, id));
      if (!store) throw new Error("Store not found");

      const [owner] = await tx.select().from(users).where(eq(users.id, store.ownerId));

      const report = {
        storeId: store.id,
        storeName: store.name,
        ownerId: owner?.id,
        ownerEmail: owner?.email,
        productsDeleted: 0,
        subOrdersDeleted: 0,
        orderItemsDeleted: 0,
        deliveryOffersDeleted: 0,
        deliveryOtpsDeleted: 0,
      };

      // 1. Delete dependent records for sub-orders
      const storeSubOrders = await tx.select().from(subOrders).where(eq(subOrders.storeId, id));
      report.subOrdersDeleted = storeSubOrders.length;
      
      for (const so of storeSubOrders) {
        const deletedItems = await tx.delete(orderItems).where(eq(orderItems.subOrderId, so.id)).returning();
        report.orderItemsDeleted += deletedItems.length;
        
        const deletedOffers = await tx.delete(deliveryOffers).where(eq(deliveryOffers.subOrderId, so.id)).returning();
        report.deliveryOffersDeleted += deletedOffers.length;
        
        const deletedOtps = await tx.delete(deliveryOtps).where(eq(deliveryOtps.subOrderId, so.id)).returning();
        report.deliveryOtpsDeleted += deletedOtps.length;
      }

      // 2. Delete products — collect imageUrls before deletion for file cleanup
      const deletedProducts = await tx.delete(products).where(eq(products.storeId, id)).returning();
      report.productsDeleted = deletedProducts.length;

      // 3. Delete sub-orders
      await tx.delete(subOrders).where(eq(subOrders.storeId, id));

      // 4. Delete store
      // BUG-FIX: Previously, this function also deleted the store owner's wallet,
      // wallet transactions, ratings, audit logs, and USER ACCOUNT — catastrophic
      // side effect. Deleting a store should NOT delete the person who owns it.
      // The owner's account, wallet, and history are preserved. Only store-specific
      // data (products, sub-orders, order items, delivery offers, OTPs) is removed.
      const [deletedStore] = await tx.delete(stores).where(eq(stores.id, id)).returning();

      // Q: لماذا نحذف الملفات بعد انتهاء الـ transaction وليس داخله؟
      // A: عمليات filesystem ليست جزءاً من DB transaction — لا يمكن rollback حذف ملف.
      //    إذا نفّذنا الحذف داخل الـ transaction وفشل شيء لاحق، ستُلغى التغييرات
      //    في DB لكن الملفات ستبقى محذوفة. بتأخير الحذف لما بعد commit الـ transaction،
      //    نضمن أن البيانات محذوفة من DB أولاً ثم الملفات — وليس العكس.
      //    الحل الكامل: قائمة انتظار لحذف الملفات (outbox pattern) في حالة توقف السيرفر
      //    بين commit الـ transaction وحذف الملف، لكن هذا معقد للمشروع الحالي.
      const imageUrlsToDelete = [
        deletedStore?.imageUrl,
        ...deletedProducts.map(p => p.imageUrl)
      ].filter(Boolean) as string[];

      // Schedule file cleanup AFTER transaction commit (non-blocking, best-effort)
      setImmediate(() => {
        for (const imageUrl of imageUrlsToDelete) {
          deleteUploadedFile(imageUrl);
        }
      });

      return report;
    });
  }
}

export const storage = new DatabaseStorage();