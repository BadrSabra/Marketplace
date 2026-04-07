import { useState } from "react";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Package,
  Loader2,
  Store as StoreIcon,
} from "lucide-react";
import { Link } from "wouter";

export default function CartPage() {
  const { items, totalItems, totalPrice, removeItem, updateQuantity, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const groupedByStore = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.storeId]) acc[item.storeId] = [];
    acc[item.storeId].push(item);
    return acc;
  }, {});

  const handlePlaceOrder = async () => {
    if (!user) {
      setLocation("/login");
      return;
    }
    if (items.length === 0) return;

    setIsPlacingOrder(true);
    try {
      const orderItems = items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      await apiRequest("POST", "/api/orders", { items: orderItems });

      toast({
        title: "تم تقديم الطلب بنجاح",
        description: "سيتم معالجة طلبك من قِبل المتاجر قريباً",
      });
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setLocation("/customer/orders");
    } catch (error: any) {
      toast({
        title: "فشل تقديم الطلب",
        description: error.message || "حدث خطأ أثناء تقديم الطلب",
        variant: "destructive",
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950" dir="rtl">
      <Navbar />

      <main className="flex-grow container px-4 py-6 md:py-10 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-black">سلة التسوق</h1>
          {totalItems > 0 && (
            <Badge className="text-sm px-3">{totalItems} منتج</Badge>
          )}
        </div>

        {items.length === 0 ? (
          <div
            className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border-dashed border-2"
            data-testid="text-empty-cart"
          >
            <div className="bg-slate-100 dark:bg-slate-800 h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="h-10 w-10 text-muted-foreground opacity-30" />
            </div>
            <h2 className="text-xl font-bold mb-2">السلة فارغة</h2>
            <p className="text-muted-foreground mb-6">أضف بعض المنتجات للبدء في التسوق</p>
            <Link href="/">
              <Button className="px-8 font-bold" data-testid="button-continue-shopping">
                <ArrowRight className="h-4 w-4 ml-2" />
                تصفح المنتجات
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Items grouped by store */}
            {Object.entries(groupedByStore).map(([storeId, storeItems]) => (
              <Card key={storeId} className="overflow-hidden" data-testid={`card-store-cart-${storeId}`}>
                <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 flex items-center gap-2 border-b">
                  <StoreIcon className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-bold text-sm">
                    {storeItems[0]?.storeName || "متجر محلي"}
                  </span>
                </div>
                <CardContent className="p-0 divide-y">
                  {storeItems.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-4 p-4"
                      data-testid={`row-cart-item-${item.productId}`}
                    >
                      {/* Image */}
                      <div className="h-16 w-16 shrink-0 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-slate-300" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-grow text-right min-w-0">
                        <p className="font-bold text-sm truncate">{item.name}</p>
                        <p className="text-primary font-extrabold text-base">
                          {(item.price * item.quantity).toFixed(2)} ج.م
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.price.toFixed(2)} ج.م × {item.quantity}
                        </p>
                      </div>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          data-testid={`button-remove-${item.productId}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="flex items-center border-2 rounded-xl overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            data-testid={`button-decrease-${item.productId}`}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span
                            className="px-3 py-1 font-bold text-sm min-w-[2rem] text-center"
                            data-testid={`text-quantity-${item.productId}`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            data-testid={`button-increase-${item.productId}`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}

            {/* Order Summary */}
            <Card data-testid="card-order-summary">
              <CardContent className="p-4 md:p-6 space-y-4">
                <h3 className="font-bold text-lg">ملخص الطلب</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-bold">{totalPrice.toFixed(2)} ج.م</span>
                    <span className="text-muted-foreground">المجموع</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-green-600">مجاني</span>
                    <span className="text-muted-foreground">التوصيل</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between font-black text-lg">
                  <span className="text-primary">{totalPrice.toFixed(2)} ج.م</span>
                  <span>الإجمالي</span>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  سيُخصم المبلغ من رصيد محفظتك عند تأكيد الطلب
                </p>
                <Button
                  className="w-full h-12 text-base font-bold rounded-xl shadow-md"
                  onClick={handlePlaceOrder}
                  disabled={isPlacingOrder}
                  data-testid="button-place-order"
                >
                  {isPlacingOrder ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin ml-2" />
                      جارٍ تقديم الطلب...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5 ml-2" />
                      تأكيد الطلب ({totalItems} منتج)
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={clearCart}
                  data-testid="button-clear-cart"
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  إفراغ السلة
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
