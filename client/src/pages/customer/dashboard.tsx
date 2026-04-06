import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useOrders } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StoreCard from "@/components/home/StoreCard";
import ProductCard from "@/components/customer/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Bell,
  ChevronLeft,
  Package,
  Wallet,
  Store as StoreIcon,
  ShoppingBag,
  Tag,
  Star,
  Loader2,
  X,
  CheckCircle2,
} from "lucide-react";

const CATEGORIES = ["الكل", "بقالة", "مطاعم", "خضروات", "صيدليات", "حلويات", "مخبوزات"];

const PROMO_BANNERS = [
  {
    id: 1,
    title: "تسوّق من متاجرك المحلية",
    subtitle: "أفضل المنتجات من ميت جابر وأسعار لا تُقارن",
    color: "from-blue-600 to-blue-800",
    icon: ShoppingBag,
  },
  {
    id: 2,
    title: "توصيل سريع لباب بيتك",
    subtitle: "طلبك يصلك في أقل من ساعة",
    color: "from-emerald-600 to-emerald-800",
    icon: Package,
  },
  {
    id: 3,
    title: "ادعم التجار المحليين",
    subtitle: "اشترِ من جيرانك وادعم اقتصادك المحلي",
    color: "from-purple-600 to-purple-800",
    icon: Star,
  },
];

function PromoBanner() {
  const [active, setActive] = useState(0);
  const banner = PROMO_BANNERS[active];
  const Icon = banner.icon;

  return (
    <div
      className={`relative rounded-2xl md:rounded-3xl bg-gradient-to-l ${banner.color} text-white p-6 md:p-10 overflow-hidden`}
      data-testid="section-hero-banner"
    >
      <div className="relative z-10 max-w-lg">
        <h2 className="text-2xl md:text-4xl font-black leading-tight mb-2">{banner.title}</h2>
        <p className="text-sm md:text-lg opacity-90 mb-6">{banner.subtitle}</p>
        <Link href="/stores">
          <Button
            variant="secondary"
            className="font-bold text-sm md:text-base px-6"
            data-testid="button-hero-cta"
          >
            تصفح المتاجر
          </Button>
        </Link>
      </div>
      <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
        <Icon className="h-40 w-40 md:h-56 md:w-56" />
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {PROMO_BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-white" : "w-2 bg-white/40"}`}
            data-testid={`button-banner-dot-${i}`}
          />
        ))}
      </div>
    </div>
  );
}

function ActiveOrdersBanner({ orders }: { orders: any[] }) {
  const { toast } = useToast();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});

  const inTransitSubOrders = useMemo(() => {
    const result: Array<{ orderId: string; subOrder: any }> = [];
    orders.forEach((order) => {
      order.subOrders?.forEach((sub: any) => {
        if (sub.status === "IN_TRANSIT") {
          result.push({ orderId: order.id, subOrder: sub });
        }
      });
    });
    return result;
  }, [orders]);

  if (inTransitSubOrders.length === 0) return null;

  const handleVerify = async (orderId: string, subOrderId: string) => {
    const otp = otpInputs[subOrderId] || "";
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      toast({
        title: "رمز التحقق غير صحيح",
        description: "يجب أن يكون الرمز مكوناً من 6 أرقام",
        variant: "destructive",
      });
      return;
    }
    try {
      setVerifyingId(subOrderId);
      await apiRequest("POST", `/api/delivery/otp/verify/${orderId}`, {
        subOrderId,
        otpCode: otp,
      });
      toast({ title: "تم التأكيد", description: "تم تأكيد استلام الطلب بنجاح" });
      setOtpInputs((prev) => ({ ...prev, [subOrderId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger/transactions"] });
    } catch (error: any) {
      toast({
        title: "فشل التأكيد",
        description: error.message || "حدث خطأ أثناء التحقق",
        variant: "destructive",
      });
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div
      className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 md:p-6"
      data-testid="section-active-orders"
    >
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-5 w-5 text-amber-600 animate-pulse" />
        <h3 className="font-bold text-amber-800 dark:text-amber-400 text-base md:text-lg">
          طلبات في الطريق إليك ({inTransitSubOrders.length})
        </h3>
      </div>
      <div className="space-y-4">
        {inTransitSubOrders.map(({ orderId, subOrder }) => (
          <div
            key={subOrder.id}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
            data-testid={`card-active-order-${subOrder.id}`}
          >
            <div className="text-right">
              <p className="font-bold text-sm">{subOrder.store?.name || "متجر محلي"}</p>
              <p className="text-xs text-muted-foreground">أدخل رمز التسليم من السائق</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Input
                placeholder="الرمز (6 أرقام)"
                value={otpInputs[subOrder.id] || ""}
                onChange={(e) =>
                  setOtpInputs((prev) => ({ ...prev, [subOrder.id]: e.target.value }))
                }
                maxLength={6}
                className="h-10 text-center font-mono tracking-widest border-2 rounded-xl w-36"
                data-testid={`input-otp-${subOrder.id}`}
              />
              <Button
                size="sm"
                onClick={() => handleVerify(orderId, subOrder.id)}
                disabled={verifyingId === subOrder.id}
                className="h-10 px-4 rounded-xl font-bold"
                data-testid={`button-verify-${subOrder.id}`}
              >
                {verifyingId === subOrder.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "تأكيد"
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4 mr-auto" />
          <Skeleton className="h-4 w-1/2 mr-auto" />
        </div>
      ))}
    </div>
  );
}

function StoresSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-4 w-2/3 mr-auto" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("الكل");

  const { useMyOrders } = useOrders();
  const { data: orders = [] } = useMyOrders();

  const { data: stores, isLoading: storesLoading } = useQuery<any[]>({
    queryKey: ["/api/public/stores"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;
    if (activeCategory !== "الكل") {
      result = result.filter(
        (p) =>
          p.category?.toLowerCase().includes(activeCategory.toLowerCase()) ||
          activeCategory === "الكل"
      );
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, searchTerm, activeCategory]);

  const filteredStores = useMemo(() => {
    if (!stores) return [];
    if (!searchTerm.trim()) return stores;
    const q = searchTerm.toLowerCase();
    return stores.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
    );
  }, [stores, searchTerm]);

  const isSearching = searchTerm.trim().length > 0;

  const handleAddToCart = () => {
    if (!user) {
      setLocation("/login");
      return;
    }
    toast({
      title: "تمت الإضافة",
      description: "تمت إضافة المنتج إلى طلبك",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950" dir="rtl">
      <Navbar />

      <main className="flex-grow">
        {/* ===== Search Bar ===== */}
        <div className="bg-white dark:bg-slate-900 border-b sticky top-16 z-40 shadow-sm">
          <div className="container px-4 py-3">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="ابحث عن منتج أو متجر..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 pr-12 pl-10 text-base rounded-xl border-2 focus-visible:ring-primary bg-slate-50 dark:bg-slate-800"
                data-testid="input-main-search"
              />
              {searchTerm && (
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setSearchTerm("")}
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="container px-4 py-6 md:py-10 space-y-10 md:space-y-14">

          {/* ===== Active Orders Banner ===== */}
          {orders.length > 0 && <ActiveOrdersBanner orders={orders} />}

          {/* ===== Search Results ===== */}
          {isSearching ? (
            <div className="space-y-10" data-testid="section-search-results">
              <div>
                <h2 className="text-xl md:text-2xl font-black mb-6 flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  نتائج البحث عن: <span className="text-primary">"{searchTerm}"</span>
                </h2>

                {/* Products results */}
                {productsLoading ? (
                  <ProductsSkeleton />
                ) : filteredProducts.length > 0 ? (
                  <>
                    <h3 className="text-lg font-bold mb-4 text-muted-foreground">
                      المنتجات ({filteredProducts.length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 mb-8">
                      {filteredProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onAddToCart={handleAddToCart}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm mb-6">لا توجد منتجات مطابقة</p>
                )}

                {/* Stores results */}
                {storesLoading ? (
                  <StoresSkeleton />
                ) : filteredStores.length > 0 ? (
                  <>
                    <h3 className="text-lg font-bold mb-4 text-muted-foreground">
                      المتاجر ({filteredStores.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                      {filteredStores.map((store) => (
                        <StoreCard key={store.id} store={store} />
                      ))}
                    </div>
                  </>
                ) : null}

                {!productsLoading && !storesLoading && filteredProducts.length === 0 && filteredStores.length === 0 && (
                  <div
                    className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl"
                    data-testid="text-no-search-results"
                  >
                    <div className="bg-slate-100 dark:bg-slate-800 h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Search className="h-10 w-10 text-muted-foreground opacity-30" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">لا توجد نتائج</h3>
                    <p className="text-muted-foreground">جرب البحث بكلمات مختلفة</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ===== Promo Banner ===== */}
              <PromoBanner />

              {/* ===== Quick Links ===== */}
              <div className="grid grid-cols-3 gap-3 md:gap-6" data-testid="section-quick-links">
                <Link href="/stores">
                  <Card className="hover:shadow-md transition-all cursor-pointer group border-2 hover:border-primary/30">
                    <CardContent className="p-4 md:p-6 flex flex-col items-center gap-2 text-center">
                      <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                        <StoreIcon className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                      </div>
                      <span className="text-xs md:text-sm font-bold">المتاجر</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/customer/wallet">
                  <Card className="hover:shadow-md transition-all cursor-pointer group border-2 hover:border-primary/30">
                    <CardContent className="p-4 md:p-6 flex flex-col items-center gap-2 text-center">
                      <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl group-hover:bg-green-200/60 dark:group-hover:bg-green-800/30 transition-colors">
                        <Wallet className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
                      </div>
                      <span className="text-xs md:text-sm font-bold">محفظتي</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/customer/transactions">
                  <Card className="hover:shadow-md transition-all cursor-pointer group border-2 hover:border-primary/30">
                    <CardContent className="p-4 md:p-6 flex flex-col items-center gap-2 text-center">
                      <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl group-hover:bg-purple-200/60 dark:group-hover:bg-purple-800/30 transition-colors">
                        <Tag className="h-6 w-6 md:h-8 md:w-8 text-purple-600" />
                      </div>
                      <span className="text-xs md:text-sm font-bold">معاملاتي</span>
                    </CardContent>
                  </Card>
                </Link>
              </div>

              {/* ===== Categories ===== */}
              <section data-testid="section-categories">
                <h2 className="text-xl md:text-2xl font-black mb-4 md:mb-6 flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  تصفح حسب التصنيف
                </h2>
                <div className="flex gap-2 md:gap-3 overflow-x-auto pb-3 no-scrollbar">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`shrink-0 px-4 md:px-6 py-2 rounded-full text-sm md:text-base font-bold border-2 transition-all whitespace-nowrap ${
                        activeCategory === cat
                          ? "bg-primary text-white border-primary shadow-md"
                          : "bg-white dark:bg-slate-800 text-foreground border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:text-primary"
                      }`}
                      data-testid={`button-category-${cat}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </section>

              {/* ===== Featured Products ===== */}
              <section data-testid="section-featured-products">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-xl md:text-2xl font-black flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    منتجات مميزة
                  </h2>
                  <Link href="/stores">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary font-bold text-sm"
                      data-testid="button-view-all-products"
                    >
                      عرض الكل
                      <ChevronLeft className="h-4 w-4 mr-1" />
                    </Button>
                  </Link>
                </div>

                {productsLoading ? (
                  <ProductsSkeleton />
                ) : filteredProducts.length === 0 ? (
                  <div
                    className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border-dashed border-2"
                    data-testid="text-empty-products"
                  >
                    <Package className="h-12 w-12 text-muted-foreground opacity-20 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">لا توجد منتجات متاحة في هذا التصنيف حالياً</p>
                    {activeCategory !== "الكل" && (
                      <Button
                        variant="link"
                        className="text-primary mt-2"
                        onClick={() => setActiveCategory("الكل")}
                      >
                        عرض جميع المنتجات
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                    {filteredProducts.slice(0, 10).map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAddToCart={handleAddToCart}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* ===== Local Stores ===== */}
              <section data-testid="section-local-stores">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-xl md:text-2xl font-black flex items-center gap-2">
                    <StoreIcon className="h-5 w-5 text-primary" />
                    المتاجر المحلية
                  </h2>
                  <Link href="/stores">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary font-bold text-sm"
                      data-testid="button-view-all-stores"
                    >
                      عرض الكل
                      <ChevronLeft className="h-4 w-4 mr-1" />
                    </Button>
                  </Link>
                </div>

                {storesLoading ? (
                  <StoresSkeleton />
                ) : !stores || stores.length === 0 ? (
                  <div
                    className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border-dashed border-2"
                    data-testid="text-empty-stores"
                  >
                    <StoreIcon className="h-12 w-12 text-muted-foreground opacity-20 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">لا توجد متاجر متاحة حالياً</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {stores.slice(0, 8).map((store) => (
                      <StoreCard key={store.id} store={store} />
                    ))}
                  </div>
                )}

                {stores && stores.length > 8 && (
                  <div className="text-center mt-6">
                    <Link href="/stores">
                      <Button variant="outline" className="px-8 font-bold border-2" data-testid="button-load-more-stores">
                        عرض كل المتاجر ({stores.length})
                      </Button>
                    </Link>
                  </div>
                )}
              </section>

              {/* ===== Completed Orders ===== */}
              {orders.length > 0 && (
                <section data-testid="section-my-orders">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h2 className="text-xl md:text-2xl font-black flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      طلباتي الأخيرة
                    </h2>
                    <Link href="/customer/transactions">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary font-bold text-sm"
                        data-testid="button-view-all-orders"
                      >
                        عرض الكل
                        <ChevronLeft className="h-4 w-4 mr-1" />
                      </Button>
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {orders.slice(0, 3).map((order: any) => (
                      <div
                        key={order.id}
                        className="bg-white dark:bg-slate-900 rounded-xl border p-4 flex items-center justify-between"
                        data-testid={`card-order-${order.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {order.overallStatus === "DELIVERED" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                          ) : (
                            <Package className="h-5 w-5 text-primary shrink-0" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            #{order.id?.split("-")[0]}
                          </span>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={order.overallStatus === "DELIVERED" ? "default" : "secondary"}
                            className="text-xs"
                            data-testid={`status-order-${order.id}`}
                          >
                            {order.overallStatus === "DELIVERED"
                              ? "تم التسليم"
                              : order.overallStatus === "IN_TRANSIT"
                              ? "في الطريق"
                              : order.overallStatus === "PENDING"
                              ? "قيد الانتظار"
                              : order.overallStatus}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {parseFloat(order.totalPrice || "0").toFixed(2)} ج.م
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
