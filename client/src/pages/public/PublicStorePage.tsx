import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Store as StoreIcon, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function PublicStorePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: [`/api/public/stores/${id}`],
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: [`/api/products`], // In real app, we'd filter by storeId via API or here
    select: (data: any[]) => data.filter(p => p.storeId === id),
  });

  const handleAddToCart = () => {
    if (!user) {
      toast({
        title: "يرجى تسجيل الدخول",
        description: "يجب تسجيل الدخول لإضافة منتجات إلى السلة",
      });
      setLocation("/login");
      return;
    }
    // Logic for cart would go here
    toast({
      title: "تمت الإضافة",
      description: "تمت إضافة المنتج إلى السلة بنجاح",
    });
  };

  if (storeLoading || productsLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-8 md:py-12 flex-grow space-y-6 md:space-y-8 px-4">
          <Skeleton className="h-32 md:h-48 w-full rounded-2xl" />
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

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        {/* Store Hero */}
        <div className="bg-slate-50 dark:bg-slate-900 border-b">
          <div className="container py-8 md:py-12 px-4">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start text-center md:text-right">
              <div className="h-24 w-24 md:h-32 md:w-32 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center border-2 overflow-hidden shrink-0">
                <StoreIcon className="h-12 w-12 md:h-16 md:w-16 text-slate-300" />
              </div>
              <div className="flex-grow">
                <div className="flex flex-col md:flex-row items-center md:justify-start gap-2 md:gap-4 mb-2">
                  <h1 className="text-2xl md:text-4xl font-bold">{store.name}</h1>
                  <Badge variant="default" className="w-fit">مفتوح</Badge>
                </div>
                <p className="text-sm md:text-lg text-muted-foreground mb-4 max-w-2xl mx-auto md:mx-0">{store.description}</p>
                <div className="flex items-center justify-center md:justify-start gap-2 text-xs md:text-sm text-muted-foreground">
                  <span className="font-medium">{store.locationText || "ميت جابر"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8 md:py-12 px-4">
          <h2 className="text-xl md:text-2xl font-bold mb-6 md:mb-8">المنتجات</h2>
          
          {products && products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {products.map((product: any) => (
                <Card key={product.id} className="overflow-hidden group">
                  <div className="h-40 md:h-48 bg-slate-100 flex items-center justify-center relative">
                    <span className="text-3xl md:text-4xl">📦</span>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-base md:text-lg mb-1 truncate">{product.name}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4 line-clamp-2 h-8 md:h-10">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg md:text-xl font-bold text-primary">{product.price} ج.م</span>
                      <Button size="sm" onClick={handleAddToCart} className="text-xs md:text-sm">
                        <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                        إضافة
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 md:py-20 bg-slate-50 rounded-2xl px-4">
              <p className="text-muted-foreground">لا توجد منتجات متاحة حالياً في هذا المتجر</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
