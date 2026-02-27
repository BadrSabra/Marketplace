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
        <div className="container py-12 flex-grow space-y-8">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
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
        <div className="container py-20 text-center flex-grow">
          <h2 className="text-2xl font-bold mb-4">المتجر غير موجود</h2>
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
          <div className="container py-12">
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
              <div className="h-32 w-32 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center border-2 overflow-hidden">
                <StoreIcon className="h-16 w-16 text-slate-300" />
              </div>
              <div className="flex-grow text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
                  <h1 className="text-4xl font-bold">{store.name}</h1>
                  <Badge variant="default">مفتوح</Badge>
                </div>
                <p className="text-muted-foreground text-lg mb-4 max-w-2xl">{store.description}</p>
                <div className="flex items-center justify-center md:justify-start gap-2 text-sm">
                  <span className="font-medium">{store.locationText || "ميت جابر"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-12">
          <h2 className="text-2xl font-bold mb-8">المنتجات</h2>
          
          {products && products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: any) => (
                <Card key={product.id} className="overflow-hidden group">
                  <div className="h-48 bg-slate-100 flex items-center justify-center relative">
                    <span className="text-4xl">📦</span>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-1">{product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-primary">{product.price} ج.م</span>
                      <Button size="sm" onClick={handleAddToCart}>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        إضافة للسلة
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50 rounded-2xl">
              <p className="text-muted-foreground">لا توجد منتجات متاحة حالياً في هذا المتجر</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
