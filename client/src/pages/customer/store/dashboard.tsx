import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, Wallet, ShoppingBag, TrendingUp, AlertTriangle, Store, ImagePlus, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { StoreLayout } from "@/components/layout/store-layout";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function StoreDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const { data: stores, isLoading: isStoresLoading } = useQuery<any[]>({
    queryKey: ["/api/stores"],
  });

  const myStore = stores?.find(s => s.ownerId === user?.id);

  const { data: products, isLoading: isProductsLoading } = useQuery<any[]>({
    queryKey: [`/api/products?store_id=${myStore?.id}`],
    enabled: !!myStore?.id,
  });

  const { data: orders, isLoading: isOrdersLoading } = useQuery<any[]>({
    queryKey: ["/api/orders/my-store"],
  });

  const { data: wallet, isLoading: isWalletLoading } = useQuery<any>({
    queryKey: ["/api/wallet"],
  });

  const isLoading = isStoresLoading || isProductsLoading || isOrdersLoading || isWalletLoading;

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="flex items-center justify-center min-h-[400px]" data-testid="dashboard-loading">
          <Spinner size="xl" />
        </div>
      </StoreLayout>
    );
  }

  if (stores && !myStore) {
    return (
      <StoreLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center" data-testid="dashboard-no-store">
          <Store className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium text-muted-foreground">{t('store.dashboard.your_store')}</p>
          <p className="text-sm text-muted-foreground">{t('store.dashboard.attention_note')}</p>
        </div>
      </StoreLayout>
    );
  }

  const lowStockProducts = products?.filter(p => p.stock > 0 && p.stock < 5) || [];
  const outOfStockProducts = products?.filter(p => p.stock === 0) || [];
  const pendingOrders = orders?.flatMap(o => o.sub_orders ?? []).filter(s => s.status === "PENDING") || [];

  const userName = user?.name || "";
  const storeName = myStore?.name || t('store.dashboard.your_store');
  const walletBalance = parseFloat(wallet?.balance || "0").toFixed(2);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myStore?.id) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "نوع ملف غير مدعوم", description: "JPG, PNG, WEBP فقط", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "الملف كبير جداً", description: "الحد الأقصى 5MB", variant: "destructive" });
      return;
    }

    setIsUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const token = localStorage.getItem("jwt_token");
      const res = await fetch(`/api/stores/${myStore.id}/image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "فشل رفع الصورة");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      toast({ title: "تم رفع صورة المتجر بنجاح" });
    } catch (err: any) {
      toast({ title: "فشل رفع صورة المتجر", description: err.message, variant: "destructive" });
    } finally {
      setIsUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  return (
    <StoreLayout>
      <div className="space-y-8 rtl:text-right" dir="auto">

        {/* Store Banner Section */}
        {myStore && (
          <div className="relative rounded-2xl overflow-hidden border border-border h-44 md:h-56 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
            {myStore.imageUrl ? (
              <img
                src={myStore.imageUrl}
                alt={myStore.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImagePlus className="h-10 w-10" />
                <p className="text-sm font-medium">لا توجد صورة غلاف للمتجر</p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-3 right-3 left-3 flex items-end justify-between">
              <p className="text-white font-bold text-lg drop-shadow">{myStore.name}</p>
              <div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleBannerUpload}
                  data-testid="input-banner-image"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2 bg-white/90 hover:bg-white text-foreground shadow"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={isUploadingBanner}
                  data-testid="button-upload-banner"
                >
                  {isUploadingBanner ? (
                    <Spinner size="sm" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {myStore.imageUrl ? "تغيير الصورة" : "رفع صورة الغلاف"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <header className="rtl:text-right">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="dashboard-title">
            {t('store.dashboard.overview')}
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="dashboard-welcome">
            {t('store.dashboard.welcome', { name: userName, store: storeName })}
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 rtl:flex-row-reverse">
          <Card className="relative overflow-hidden group border-primary/20 bg-primary/5 rtl:text-right">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 rtl:flex-row-reverse">
              <CardTitle className="text-sm font-medium">{t('store.dashboard.wallet_balance')}</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-wallet-balance">{walletBalance} ج.م</div>
              <p className="text-xs text-muted-foreground mt-1">{t('store.earnings.balance_note')}</p>
            </CardContent>
          </Card>

          <Card className="rtl:text-right">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 rtl:flex-row-reverse">
              <CardTitle className="text-sm font-medium">{t('store.dashboard.pending_orders')}</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-pending-orders">{pendingOrders.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('store.dashboard.attention_note')}</p>
            </CardContent>
          </Card>

          <Card className="rtl:text-right">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 rtl:flex-row-reverse">
              <CardTitle className="text-sm font-medium">{t('store.dashboard.active_products')}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-active-products">{products?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('store.dashboard.catalog_note')}</p>
            </CardContent>
          </Card>

          <Card className="rtl:text-right">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 rtl:flex-row-reverse">
              <CardTitle className="text-sm font-medium">{t('store.dashboard.inventory_health')}</CardTitle>
              <AlertTriangle className={cn("h-4 w-4", lowStockProducts.length + outOfStockProducts.length > 0 ? "text-yellow-500" : "text-green-500")} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-out-of-stock">{outOfStockProducts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('store.dashboard.out_of_stock_note')}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 rtl:flex-row-reverse">
          <Card className="col-span-full lg:col-span-4 rtl:text-right">
            <CardHeader>
              <CardTitle>{t('store.dashboard.quick_actions')}</CardTitle>
              <CardDescription>{t('store.dashboard.actions_subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 rtl:flex-row-reverse">
              <Link href="/store/dashboard/orders">
                <Button
                  className="w-full justify-start h-16 gap-4 rtl:flex-row-reverse"
                  variant="outline"
                  data-testid="btn-manage-orders"
                >
                  <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div className="text-left rtl:text-right">
                    <div className="font-semibold">{t('store.dashboard.manage_orders')}</div>
                    <div className="text-xs text-muted-foreground">{t('store.dashboard.process_note')}</div>
                  </div>
                </Button>
              </Link>
              <Link href="/store/inventory">
                <Button
                  className="w-full justify-start h-16 gap-4 rtl:flex-row-reverse"
                  variant="outline"
                  data-testid="btn-product-catalog"
                >
                  <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="text-left rtl:text-right">
                    <div className="font-semibold">{t('store.dashboard.product_catalog')}</div>
                    <div className="text-xs text-muted-foreground">{t('store.dashboard.edit_note')}</div>
                  </div>
                </Button>
              </Link>
              <Link href="/store/earnings">
                <Button
                  className="w-full justify-start h-16 gap-4 rtl:flex-row-reverse"
                  variant="outline"
                  data-testid="btn-view-earnings"
                >
                  <div className="bg-green-500/10 p-2 rounded-lg text-green-500">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="text-left rtl:text-right">
                    <div className="font-semibold">{t('store.dashboard.view_earnings')}</div>
                    <div className="text-xs text-muted-foreground">{t('store.dashboard.track_note')}</div>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="col-span-full lg:col-span-3 rtl:text-right">
            <CardHeader className="rtl:text-right">
              <CardTitle className="flex items-center gap-2 rtl:flex-row-reverse">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                {t('store.dashboard.inventory_alerts')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 rtl:text-right" data-testid="inventory-alerts">
                {outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed" data-testid="alerts-healthy">
                    {t('store.dashboard.healthy_note')}
                  </p>
                ) : (
                  <>
                    {outOfStockProducts.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 border rounded-lg bg-destructive/5 border-destructive/20 rtl:flex-row-reverse"
                        data-testid={`alert-out-of-stock-${p.id}`}
                      >
                        <span className="text-sm font-medium">{p.name}</span>
                        <Badge variant="destructive">{t('store.dashboard.out_of_stock')}</Badge>
                      </div>
                    ))}
                    {lowStockProducts.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 border rounded-lg bg-yellow-50 border-yellow-200 rtl:flex-row-reverse"
                        data-testid={`alert-low-stock-${p.id}`}
                      >
                        <span className="text-sm font-medium">{p.name}</span>
                        <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                          {t('store.dashboard.low_stock_left', { count: p.stock })}
                        </Badge>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </StoreLayout>
  );
}
