import { db } from "../db";
import { users, wallets, stores, products } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const EMAIL = "awlad.azab@supermarket.com";
const PASSWORD = "AwladAzab@2024";
const STORE_NAME = "سوبر ماركت أولاد عزب";

const supermarketProducts = [
  // البقالة والمواد الغذائية الأساسية
  { name: "أرز مصري الضهة", description: "أرز مصري فاخر حبة متوسطة - 1 كجم", price: "45.00", stock: 200, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1536304993881-ff86e0c9f2a3?w=400" },
  { name: "دقيق الضهة متعدد الأغراض", description: "دقيق أبيض فاخر لجميع الاستخدامات - 1 كجم", price: "28.00", stock: 150, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400" },
  { name: "سكر أبيض ناعم", description: "سكر أبيض ناعم عالي الجودة - 1 كجم", price: "35.00", stock: 200, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400" },
  { name: "زيت ذرة صافي", description: "زيت ذرة صافي للطهي - 1.5 لتر", price: "75.00", stock: 120, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400" },
  { name: "زيت زيتون بكر ممتاز", description: "زيت زيتون بكر ممتاز إضافي - 750 مل", price: "120.00", stock: 80, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400" },
  { name: "عدس أحمر مقشور", description: "عدس أحمر مقشور فاخر - 500 جم", price: "22.00", stock: 180, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400" },
  { name: "فول مدمس", description: "فول مدمس جاهز للأكل - علبة 400 جم", price: "18.00", stock: 200, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400" },
  { name: "معكرونة سباغيتي", description: "معكرونة سباغيتي إيطالية - 500 جم", price: "25.00", stock: 150, category: "بقالة وغذاء أساسي", imageUrl: "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400" },
  { name: "خبز توست أبيض", description: "خبز توست أبيض طازج - رغيف 500 جم", price: "20.00", stock: 100, category: "مخبوزات", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400" },
  { name: "خبز عيش بلدي", description: "عيش بلدي طازج - كيس 10 أرغفة", price: "15.00", stock: 150, category: "مخبوزات", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400" },

  // منتجات الألبان والبيض
  { name: "لبن طازج كامل الدسم", description: "لبن طازج بستريز كامل الدسم - 1 لتر", price: "32.00", stock: 100, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400" },
  { name: "زبادي طبيعي", description: "زبادي طبيعي كريمي - 4 أكواب", price: "28.00", stock: 80, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400" },
  { name: "جبنة رومي مطبوخة", description: "جبنة رومي مطبوخة فاخرة - 200 جم", price: "45.00", stock: 60, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400" },
  { name: "جبنة أبيض بلدي", description: "جبنة بيضاء طازجة - 250 جم", price: "35.00", stock: 80, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400" },
  { name: "بيض بلدي طازج", description: "بيض بلدي طازج - كرتونة 15 بيضة", price: "65.00", stock: 120, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400" },
  { name: "زبدة طبيعية", description: "زبدة طبيعية مملحة - 200 جم", price: "55.00", stock: 70, category: "ألبان وبيض", imageUrl: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400" },

  // الخضروات والفواكه
  { name: "طماطم طازجة", description: "طماطم مصرية طازجة - 1 كجم", price: "15.00", stock: 100, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400" },
  { name: "بطاطس مصرية", description: "بطاطس مصرية طازجة - 1 كجم", price: "12.00", stock: 150, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400" },
  { name: "بصل جاف", description: "بصل جاف مصري - 1 كجم", price: "10.00", stock: 200, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400" },
  { name: "ثوم بلدي", description: "ثوم بلدي طازج - 250 جم", price: "20.00", stock: 100, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=400" },
  { name: "موز", description: "موز طازج من أجود الأصناف - 1 كجم", price: "30.00", stock: 80, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400" },
  { name: "تفاح أحمر", description: "تفاح أحمر طازج - 1 كجم", price: "45.00", stock: 70, category: "خضروات وفواكه", imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400" },

  // اللحوم والدواجن
  { name: "فراخ بيضاء طازجة", description: "دجاج كامل طازج - 1 كجم", price: "95.00", stock: 60, category: "لحوم ودواجن", imageUrl: "https://images.unsplash.com/photo-1604503468506-a8da13d11bae?w=400" },
  { name: "فيليه دجاج", description: "فيليه صدر دجاج طازج بدون عظم - 1 كجم", price: "130.00", stock: 50, category: "لحوم ودواجن", imageUrl: "https://images.unsplash.com/photo-1604503468506-a8da13d11bae?w=400" },
  { name: "لحم بتلو مفروم", description: "لحم بتلو مفروم طازج - 500 جم", price: "120.00", stock: 40, category: "لحوم ودواجن", imageUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400" },

  // المشروبات
  { name: "مياه معدنية بارودة", description: "مياه معدنية نقية - 1.5 لتر", price: "10.00", stock: 300, category: "مشروبات", imageUrl: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400" },
  { name: "عصير برتقال طبيعي", description: "عصير برتقال 100% طبيعي - 1 لتر", price: "45.00", stock: 80, category: "مشروبات", imageUrl: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400" },
  { name: "كولا", description: "مشروب غازي كولا - 1.5 لتر", price: "28.00", stock: 150, category: "مشروبات", imageUrl: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400" },
  { name: "شاي أحمر أكياس", description: "شاي أحمر أكياس فاخر - علبة 100 كيس", price: "55.00", stock: 100, category: "مشروبات", imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
  { name: "نسكافيه قهوة فورية", description: "نسكافيه قهوة فورية - 200 جم", price: "85.00", stock: 70, category: "مشروبات", imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400" },

  // الوجبات الخفيفة والحلويات
  { name: "شيبسي بطاطس مقرمشة", description: "شيبسي بطاطس مقرمشة بالملح - 80 جم", price: "18.00", stock: 150, category: "وجبات خفيفة", imageUrl: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400" },
  { name: "كيكة شوكولاتة", description: "كيكة شوكولاتة فاخرة - 350 جم", price: "42.00", stock: 60, category: "وجبات خفيفة", imageUrl: "https://images.unsplash.com/photo-1548368814-1f7ec1261b60?w=400" },
  { name: "بسكويت شاي ماري", description: "بسكويت ماري للشاي - 200 جم", price: "25.00", stock: 120, category: "وجبات خفيفة", imageUrl: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400" },
  { name: "شوكولاتة حليب", description: "شوكولاتة حليب كاملة - 100 جم", price: "35.00", stock: 100, category: "وجبات خفيفة", imageUrl: "https://images.unsplash.com/photo-1548907040-4baa42d10919?w=400" },
  { name: "حلاوة طحينية", description: "حلاوة طحينية سادة فاخرة - 500 جم", price: "48.00", stock: 80, category: "وجبات خفيفة", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400" },

  // العناية الشخصية والنظافة
  { name: "صابون استحمام", description: "صابون استحمام بجليسرين - 3 قطع", price: "32.00", stock: 150, category: "عناية شخصية", imageUrl: "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=400" },
  { name: "شامبو للشعر العادي", description: "شامبو مغذي للشعر العادي - 400 مل", price: "65.00", stock: 80, category: "عناية شخصية", imageUrl: "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400" },
  { name: "معجون أسنان بالفلوريد", description: "معجون أسنان بالفلوريد للحماية - 100 مل", price: "35.00", stock: 120, category: "عناية شخصية", imageUrl: "https://images.unsplash.com/photo-1605634279219-b1a4ce4e7b90?w=400" },
  { name: "فوطة صحية نهارية", description: "فوطة صحية نهارية فائقة الامتصاص - 8 قطع", price: "28.00", stock: 100, category: "عناية شخصية", imageUrl: "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=400" },

  // منتجات التنظيف
  { name: "سائل جلي الصحون", description: "سائل جلي الصحون معطر - 500 مل", price: "22.00", stock: 150, category: "منتجات تنظيف", imageUrl: "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400" },
  { name: "مسحوق غسيل ملابس", description: "مسحوق غسيل الملابس الملون والأبيض - 1 كجم", price: "55.00", stock: 100, category: "منتجات تنظيف", imageUrl: "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400" },
  { name: "مطهر متعدد الأسطح", description: "مطهر ومعقم متعدد الأسطح برائحة الورد - 750 مل", price: "38.00", stock: 80, category: "منتجات تنظيف", imageUrl: "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400" },
  { name: "إسفنجة جلي المطبخ", description: "إسفنجة جلي المطبخ 2 في 1 - 3 قطع", price: "18.00", stock: 200, category: "منتجات تنظيف", imageUrl: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400" },

  // الأجبان والمعلبات
  { name: "تونة معلبة بالزيت", description: "تونة معلبة بزيت الذرة - 185 جم", price: "32.00", stock: 200, category: "معلبات", imageUrl: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=400" },
  { name: "صلصة طماطم معلبة", description: "صلصة طماطم معلبة جاهزة - 400 جم", price: "25.00", stock: 150, category: "معلبات", imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400" },
  { name: "ذرة معلبة صفراء", description: "ذرة صفراء معلبة طبيعية - 340 جم", price: "20.00", stock: 180, category: "معلبات", imageUrl: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400" },
  { name: "فاصوليا بيضاء معلبة", description: "فاصوليا بيضاء معلبة بالصلصة - 400 جم", price: "22.00", stock: 150, category: "معلبات", imageUrl: "https://images.unsplash.com/photo-1584348571977-09f3b7ab7a00?w=400" },
];

async function seed() {
  console.log("🚀 بدء إنشاء حساب سوبر ماركت أولاد عزب...");

  // 1. تحقق إذا كان الحساب موجوداً بالفعل
  const existing = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
  
  let userId: string;
  
  if (existing.length > 0) {
    userId = existing[0].id;
    console.log(`✅ الحساب موجود بالفعل: ${userId}`);
  } else {
    // 2. إنشاء حساب صاحب المتجر
    const hashedPassword = await bcrypt.hash(PASSWORD, 10);
    const [newUser] = await db.insert(users).values({
      name: "سوبر ماركت أولاد عزب",
      email: EMAIL,
      password: hashedPassword,
      phone: "01000000001",
      role: "STORE_OWNER",
      isApproved: true,
    }).returning();
    userId = newUser.id;
    console.log(`✅ تم إنشاء المستخدم: ${userId}`);

    // 3. إنشاء محفظة للمستخدم
    await db.insert(wallets).values({
      userId: userId,
      balance: "0.00",
    });
    console.log("✅ تم إنشاء المحفظة");
  }

  // 4. تحقق أو أنشئ المتجر
  const existingStore = await db.select().from(stores).where(eq(stores.ownerId, userId)).limit(1);
  
  let storeId: string;
  
  if (existingStore.length > 0) {
    storeId = existingStore[0].id;
    console.log(`✅ المتجر موجود بالفعل: ${storeId}`);
  } else {
    const [newStore] = await db.insert(stores).values({
      ownerId: userId,
      name: STORE_NAME,
      type: "سوبر ماركت",
      description: "سوبر ماركت أولاد عزب - وجهتك الأولى لأفضل المنتجات الغذائية ومستلزمات المنزل بأسعار مناسبة وجودة عالية",
      locationText: "ميت غمر، محافظة الدقهلية",
      imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800",
    }).returning();
    storeId = newStore.id;
    console.log(`✅ تم إنشاء المتجر: ${storeId}`);
  }

  // 5. إضافة المنتجات
  const existingProducts = await db.select().from(products).where(eq(products.storeId, storeId));
  
  if (existingProducts.length > 0) {
    console.log(`✅ المنتجات موجودة بالفعل (${existingProducts.length} منتج)`);
  } else {
    let count = 0;
    for (const product of supermarketProducts) {
      await db.insert(products).values({
        storeId: storeId,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        category: product.category,
        imageUrl: product.imageUrl,
      });
      count++;
    }
    console.log(`✅ تم إضافة ${count} منتج بنجاح`);
  }

  console.log("\n====================================");
  console.log("🎉 تم الإعداد بنجاح!");
  console.log("====================================");
  console.log(`📧 البريد الإلكتروني: ${EMAIL}`);
  console.log(`🔑 كلمة المرور: ${PASSWORD}`);
  console.log(`🏪 اسم المتجر: ${STORE_NAME}`);
  console.log(`🆔 معرف المتجر: ${storeId}`);
  console.log("====================================");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ خطأ:", err);
  process.exit(1);
});
