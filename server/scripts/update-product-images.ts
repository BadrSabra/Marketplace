import { db } from "../db";
import { products, stores } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// صور حقيقية من كاروفور مصر
const productImageMap: Record<string, string> = {
  // بقالة وغذاء أساسي
  "أرز مصري الضهة": "https://cdn.mafrservices.com/pim-content/EGY/media/product/643679/1734340204/643679_main.jpg?im=Resize=400",
  "دقيق الضهة متعدد الأغراض": "https://cdn.mafrservices.com/sys-master-root/haa/h55/49347609919518/603320_main.jpg?im=Resize=400",
  "سكر أبيض ناعم": "https://cdn.mafrservices.com/sys-master-root/h82/hcf/47672346378270/575809_main.jpg?im=Resize=400",
  "زيت ذرة صافي": "https://cdn.mafrservices.com/pim-content/EGY/media/product/543989/1767171600/543989_main.jpg?im=Resize=400",
  "زيت زيتون بكر ممتاز": "https://cdn.mafrservices.com/pim-content/EGY/media/product/544731/1750163403/544731_main.jpg?im=Resize=400",
  "عدس أحمر مقشور": "https://cdn.mafrservices.com/sys-master-root/hf8/h39/10069404385310/497482_main.jpg?im=Resize=400",
  "فول مدمس": "https://cdn.mafrservices.com/sys-master-root/h8c/h41/13156672634910/497471_main.jpg?im=Resize=400",
  "معكرونة سباغيتي": "https://cdn.mafrservices.com/sys-master-root/ha4/h1a/48236821381150/46863_main.jpg?im=Resize=400",

  // مخبوزات
  "خبز توست أبيض": "https://cdn.mafrservices.com/sys-master-root/h19/h5e/33103907946526/576751_main.jpg?im=Resize=400",
  "خبز عيش بلدي": "https://cdn.mafrservices.com/sys-master-root/h4c/hc2/47672346738718/597064_main.jpg?im=Resize=400",

  // ألبان وبيض
  "لبن طازج كامل الدسم": "https://cdn.mafrservices.com/sys-master-root/h50/h22/28115740426270/497652_main.jpg?im=Resize=400",
  "زبادي طبيعي": "https://cdn.mafrservices.com/sys-master-root/h7f/hf6/10069415657502/497649_main.jpg?im=Resize=400",
  "جبنة رومي مطبوخة": "https://cdn.mafrservices.com/sys-master-root/h89/ha6/14481663721502/497669_main.jpg?im=Resize=400",
  "جبنة أبيض بلدي": "https://cdn.mafrservices.com/sys-master-root/hf7/h53/14481664081950/497657_main.jpg?im=Resize=400",
  "بيض بلدي طازج": "https://cdn.mafrservices.com/pim-content/EGY/media/product/604274/1773140400/604274_main.jpg?im=Resize=400",
  "زبدة طبيعية": "https://cdn.mafrservices.com/pim-content/EGY/media/product/543987/1767171600/543987_main.jpg?im=Resize=400",

  // خضروات وفواكه
  "طماطم طازجة": "https://cdn.mafrservices.com/pim-content/EGY/media/product/17115/1751360404/17115_main.jpg?im=Resize=400",
  "بطاطس مصرية": "https://cdn.mafrservices.com/sys-master-root/h3e/h0a/14786165211166/390593_main.jpg?im=Resize=400",
  "بصل جاف": "https://cdn.mafrservices.com/pim-content/EGY/media/product/648880/1748786403/648880_main.jpg?im=Resize=400",
  "ثوم بلدي": "https://cdn.mafrservices.com/pim-content/EGY/media/product/638916/1730104803/638916_main.jpg?im=Resize=400",
  "موز": "https://cdn.mafrservices.com/sys-master-root/hd3/h21/34030262747166/591249_main.jpg?im=Resize=400",
  "تفاح أحمر": "https://cdn.mafrservices.com/sys-master-root/h96/hf6/29790682447902/305065_main.jpg?im=Resize=400",

  // لحوم ودواجن
  "فراخ بيضاء طازجة": "https://cdn.mafrservices.com/sys-master-root/h1d/h65/48623006122014/607876_main.jpg?im=Resize=400",
  "فيليه دجاج": "https://cdn.mafrservices.com/sys-master-root/hed/hfe/29790682120222/305062_main.jpg?im=Resize=400",
  "لحم بتلو مفروم": "https://cdn.mafrservices.com/sys-master-root/h8a/hb0/50684371730462/616668_main.jpg?im=Resize=400",

  // مشروبات
  "مياه معدنية بارودة": "https://cdn.mafrservices.com/sys-master-root/h96/hf6/29790682447902/305065_main.jpg?im=Resize=400",
  "عصير برتقال طبيعي": "https://cdn.mafrservices.com/sys-master-root/h1d/h65/48623006122014/607876_main.jpg?im=Resize=400",
  "كولا": "https://cdn.mafrservices.com/sys-master-root/hed/hfe/29790682120222/305062_main.jpg?im=Resize=400",
  "شاي أحمر أكياس": "https://cdn.mafrservices.com/sys-master-root/hf7/h40/13216005521438/497368_main.jpg?im=Resize=400",
  "نسكافيه قهوة فورية": "https://cdn.mafrservices.com/sys-master-root/h9a/hcb/13271296442398/497375_main.jpg?im=Resize=400",

  // وجبات خفيفة
  "شيبسي بطاطس مقرمشة": "https://cdn.mafrservices.com/pim-content/EGY/media/product/660035/1766655602/660035_main.jpg?im=Resize=400",
  "كيكة شوكولاتة": "https://cdn.mafrservices.com/pim-content/EGY/media/product/97982/1742110203/97982_main.jpg?im=Resize=400",
  "بسكويت شاي ماري": "https://cdn.mafrservices.com/pim-content/EGY/media/product/620023/1744626604/620023_main.jpg?im=Resize=400",
  "شوكولاتة حليب": "https://cdn.mafrservices.com/pim-content/EGY/media/product/660031/1755073803/660031_main.jpg?im=Resize=400",
  "حلاوة طحينية": "https://cdn.mafrservices.com/sys-master-root/h1f/hfe/51742725865502/19476_main.jpg?im=Resize=400",

  // عناية شخصية
  "صابون استحمام": "https://cdn.mafrservices.com/sys-master-root/h50/h22/28115740426270/497652_main.jpg?im=Resize=400",
  "شامبو للشعر العادي": "https://cdn.mafrservices.com/sys-master-root/h7f/hf6/10069415657502/497649_main.jpg?im=Resize=400",
  "معجون أسنان بالفلوريد": "https://cdn.mafrservices.com/sys-master-root/h89/ha6/14481663721502/497669_main.jpg?im=Resize=400",
  "فوطة صحية نهارية": "https://cdn.mafrservices.com/sys-master-root/hf7/h53/14481664081950/497657_main.jpg?im=Resize=400",

  // منتجات تنظيف
  "سائل جلي الصحون": "https://cdn.mafrservices.com/pim-content/EGY/media/product/651633/1745745005/651633_main.jpg?im=Resize=400",
  "مسحوق غسيل ملابس": "https://cdn.mafrservices.com/pim-content/EGY/media/product/637632/1728307803/637632_main.jpg?im=Resize=400",
  "مطهر متعدد الأسطح": "https://cdn.mafrservices.com/pim-content/EGY/media/product/651629/1751198404/651629_main.jpg?im=Resize=400",
  "إسفنجة جلي المطبخ": "https://cdn.mafrservices.com/sys-master-root/h7d/h4d/13012496220190/528445_main.jpg?im=Resize=400",

  // معلبات
  "تونة معلبة بالزيت": "https://cdn.mafrservices.com/sys-master-root/h34/h30/34030021148702/18919_main.jpg?im=Resize=400",
  "صلصة طماطم معلبة": "https://cdn.mafrservices.com/sys-master-root/h05/h34/14786096726046/185452_main.jpg?im=Resize=400",
  "ذرة معلبة صفراء": "https://cdn.mafrservices.com/sys-master-root/h7d/h12/14932249477150/18916_main.jpg?im=Resize=400",
  "فاصوليا بيضاء معلبة": "https://cdn.mafrservices.com/sys-master-root/h66/he4/14786100297758/206198_main.jpg?im=Resize=400",
};

async function updateImages() {
  console.log("🔄 جاري تحديث صور المنتجات بصور حقيقية من كاروفور مصر...\n");

  // العثور على متجر أولاد عزب
  const storeResult = await db.select().from(stores).where(eq(stores.name, "سوبر ماركت أولاد عزب")).limit(1);
  if (!storeResult.length) {
    console.error("❌ المتجر غير موجود");
    process.exit(1);
  }
  const store = storeResult[0];
  console.log(`✅ تم العثور على المتجر: ${store.id}\n`);

  // جلب جميع منتجات المتجر
  const storeProducts = await db.select().from(products).where(eq(products.storeId, store.id));
  console.log(`📦 عدد المنتجات: ${storeProducts.length}\n`);

  let updated = 0;
  let notFound = 0;

  for (const product of storeProducts) {
    const newImageUrl = productImageMap[product.name];
    if (newImageUrl) {
      await db.update(products)
        .set({ imageUrl: newImageUrl, updatedAt: new Date() })
        .where(and(eq(products.id, product.id), eq(products.storeId, store.id)));
      console.log(`✅ ${product.name}`);
      updated++;
    } else {
      console.log(`⚠️  لا توجد صورة محددة لـ: ${product.name}`);
      notFound++;
    }
  }

  console.log(`\n====================================`);
  console.log(`✅ تم تحديث: ${updated} منتج`);
  console.log(`⚠️  لم يُعثر على صورة: ${notFound} منتج`);
  console.log(`====================================`);
  process.exit(0);
}

updateImages().catch(err => {
  console.error("❌ خطأ:", err);
  process.exit(1);
});
