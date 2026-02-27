import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, Wallet, ShoppingBag, TrendingUp, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { StoreLayout } from "@/components/layout/store-layout";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

export default function StoreDashboard() {
  const { user } = useAuth();
  
  const { data: stores } = useQuery<any[]>({
    queryKey: ["/api/stores"],
  });
  
  const myStore = stores?.find(s => s.ownerId === user?.id);

  const { data: products, isLoading: isProductsLoading } = useQuery<any[]>({
    queryKey: ["/api/products", { storeId: myStore?.id }],
    enabled: !!myStore?.id,
  });

  const { data: orders, isLoading: isOrdersLoading } = useQuery<any[]>({
    queryKey: ["/api/orders/my-store"],
    enabled: !!myStore?.id,
  });

  const { data: wallet, isLoading: isWalletLoading } = useQuery<any>({
    queryKey: ["/api/wallet"],
  });

  if (isProductsLoading || isOrdersLoading || isWalletLoading) {
    return (
      <StoreLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="xl" />
        </div>
      </StoreLayout>
    );
  }

  const lowStockProducts = products?.filter(p => p.stock > 0 && p.stock < 5) || [];
  const outOfStockProducts = products?.filter(p => p.stock === 0) || [];
  const pendingOrders = orders?.flatMap(o => o.sub_orders).filter(s => s.status === "PENDING") || [];

  return (
    <StoreLayout>
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Store Overview</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user?.name}. Here's what's happening with {myStore?.name || 'your store'}.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden group border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${parseFloat(wallet?.balance || "0").toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Available for withdrawal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingOrders.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Requires your attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Total items in catalog</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Health</CardTitle>
              <AlertTriangle className={cn("h-4 w-4", lowStockProducts.length + outOfStockProducts.length > 0 ? "text-yellow-500" : "text-green-500")} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{outOfStockProducts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Out of stock items</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-full lg:col-span-4">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used management tools</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Link href="/store/dashboard/orders">
                <Button className="w-full justify-start h-16 gap-4" variant="outline">
                  <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">Manage Orders</div>
                    <div className="text-xs text-muted-foreground">Process incoming requests</div>
                  </div>
                </Button>
              </Link>
              <Link href="/store/inventory">
                <Button className="w-full justify-start h-16 gap-4" variant="outline">
                  <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">Product Catalog</div>
                    <div className="text-xs text-muted-foreground">Add and edit products</div>
                  </div>
                </Button>
              </Link>
              <Link href="/store/earnings">
                <Button className="w-full justify-start h-16 gap-4" variant="outline">
                  <div className="bg-green-500/10 p-2 rounded-lg text-green-500">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">View Earnings</div>
                    <div className="text-xs text-muted-foreground">Track your commissions</div>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="col-span-full lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Inventory Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                    Your inventory is looking healthy!
                  </p>
                ) : (
                  <>
                    {outOfStockProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 border rounded-lg bg-destructive/5 border-destructive/20">
                        <span className="text-sm font-medium">{p.name}</span>
                        <Badge variant="destructive">Out of Stock</Badge>
                      </div>
                    ))}
                    {lowStockProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 border rounded-lg bg-yellow-50 border-yellow-200">
                        <span className="text-sm font-medium">{p.name}</span>
                        <Badge variant="outline" className="text-yellow-700 border-yellow-300">Only {p.stock} left</Badge>
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

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
