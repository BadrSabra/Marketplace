import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Store as StoreIcon, ImageOff, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/use-cart";
import { useState } from "react";

function ProductItem({ product, storeName, onRequireLogin }: { product: any; storeName: string; onRequireLogin: () => void }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [added, setAdded] = useState(false);

  // Q: هل يجب منع إضافة المنتج للسلة عندما يكون مخزونه 0؟
  // A: نعم — الكود السابق لم يكن يتحقق من المخزون إطلاقاً في الواجهة الأمامية.
  //    المستخدم يستطيع إضافة منتج نفد مخزونه للسلة ثم تقديم الطلب، وسيرفضه الـ backend
  //    بخطأ "Not enough stock" — تجربة مستخدم سيئة: إضافة + ملء السلة + اكتشاف الرفض
  //    عند الدفع بدلاً من منع الإضافة من البداية.
  //    stock === null يعني "مخزون غير محدود" (تُركه يعمل).
  //    stock === 0 يعني "نفد المخزون" — يجب تعطيل الزر وعرض شارة "نفد".
  const isOutOfStock = product.stock !== null && product.stock !== undefined && product.stock <= 0;

  const handleAdd = () => {
    if (!user) {
      onRequireLogin();
      return;
    }
    if (isOutOfStock) return;
    addItem({
      productId: product.id,
      name: product.name,
      price: parseFloat(product.price) || 0,
      storeId: product.storeId,
      storeName,
      imageUrl: product.imageUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    toast({ title: "تمت الإضافة", description: "تمت إضافة المنتج إلى السلة بنجاح" });
  };

  return (
    <Card className={`overflow-hidden group hover:shadow-md transition-shadow ${isOutOfStock ? "opacity-60" : ""}`}>
      <div className="h-40 md:h-48 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <ImageOff className="h-12 w-12 text-slate-300 dark:text-slate-600" />
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">نفد المخزون</span>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-bold text-base md:text-lg mb-1 truncate">{product.name}</h3>
        <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4 line-clamp-2 h-8 md:h-10">{product.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-lg md:text-xl font-bold text-primary">{product.price} ج.م</span>
          <Button
            size="sm"
            variant={added ? "outline" : "default"}
            onClick={handleAdd}
            disabled={isOutOfStock}
            className={`text-xs md:text-sm transition-all ${added ? "border-green-500 text-green-600" : ""}`}
            data-testid={`button-add-cart-${product.id}`}
          >
            {added ? (
              <><Check className="h-3 w-3 ml-1 text-green-600" />تمت الإضافة</>
            ) : isOutOfStock ? (
              <>نفد المخزون</>
            ) : (
              <><ShoppingCart className="h-3 w-3 md:h-4 md:w-4 ml-1 md:ml-2" />إضافة</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublicStorePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: [`/api/public/stores/${id}`],
  });

  // Q: لماذا نستخدم store_id كمعامل في الطلب بدلاً من جلب كل المنتجات وتصفيتها؟
  // A: الكود السابق كان يجلب كامل قائمة المنتجات من كل المتاجر (/api/products بدون فلتر)
  //    ثم يُصفّيها محلياً بـ .filter(p => p.storeId === id).
  //    هذا يعني:
  //    1. تنزيل 100-500+ منتج (حسب حجم المنصة) لعرض 5-20 منتج فقط.
  //    2. مفتاح الكاش ['/api/products'] يُشارَك بين كل المتاجر — إذا زار المستخدم
  //       متجراً آخر يُستخدم نفس الكاش المُجمَّع بدلاً من بيانات المتجر المحدد.
  //    3. أي تحديث (invalidation) يمس الكاش المشترك ويُعيد تحميل كل المنتجات.
  //    الإصلاح: تمرير store_id كمعامل في URL حتى يُصفّي الـ backend البيانات قبل الإرسال،
  //    وتضمين store_id في مفتاح الكاش لعزل بيانات كل متجر عن غيره.
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: [`/api/products`, { store_id: id }],
    queryFn: async () => {
      const res = await fetch(`/api/products?store_id=${id}`);
      if (!res.ok) throw new Error("فشل تحميل المنتجات");
      return res.json();
    },
  });

  const handleRequireLogin = () => {
    toast({
      title: "يرجى تسجيل الدخول",
      description: "يجب تسجيل الدخول لإضافة منتجات إلى السلة",
    });
    setLocation("/login");
  };

  if (storeLoading || productsLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-8 md:py-12 flex-grow space-y-6 md:space-y-8 px-4">
          <Skeleton className="h-48 md:h-64 w-full rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 md:h-64 rounded-xl" />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center flex-grow px-4">
          <h2 className="text-xl md:text-2xl font-bold mb-4">المتجر غير موجود</h2>
          <Button onClick={() => setLocation("/")}>العودة للرئيسية</Button>
        </div>
        <Footer />
      </div>
    );
  }

  const storeData = store as any;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        {/* Store Banner */}
        <div className="relative w-full h-48 md:h-72 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 overflow-hidden">
          {storeData.imageUrl ? (
            <img
              src={storeData.imageUrl}
              alt={`${storeData.name} banner`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <StoreIcon className="h-20 w-20 text-slate-400 dark:text-slate-500" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-4 right-4 left-4">
            <div className="flex items-end gap-3">
              <div>
                <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow">{storeData.name}</h1>
                {storeData.description && (
                  <p className="text-sm md:text-base text-white/80 mt-1 max-w-xl line-clamp-2">{storeData.description}</p>
                )}
              </div>
              <Badge className={`mb-1 border-0 text-white ${storeData.isOpen ? "bg-green-500" : "bg-slate-500"}`}>
                {storeData.isOpen ? "مفتوح" : "مغلق"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="container py-8 md:py-12 px-4">
          {storeData.locationText && (
            <p className="text-sm text-muted-foreground mb-6">📍 {storeData.locationText}</p>
          )}

          <h2 className="text-xl md:text-2xl font-bold mb-6 md:mb-8">المنتجات</h2>
          
          {products && products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {products.map((product: any) => (
                <ProductItem
                  key={product.id}
                  product={product}
                  storeName={storeData.name}
                  onRequireLogin={handleRequireLogin}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 md:py-20 bg-slate-50 dark:bg-slate-900 rounded-2xl px-4">
              <p className="text-muted-foreground">لا توجد منتجات متاحة حالياً في هذا المتجر</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
