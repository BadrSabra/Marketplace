import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Wallet, ShoppingBag, LayoutDashboard } from "lucide-react";

export default function StoreDashboard() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Store Owner Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your store, products, and incoming orders.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/store/dashboard/orders">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Incoming Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Orders</div>
              <p className="text-xs text-muted-foreground mt-1">View and manage customer orders</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/products">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Products</div>
              <p className="text-xs text-muted-foreground mt-1">Manage your product catalog</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/customer/wallet">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Earnings & Wallet</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Wallet</div>
              <p className="text-xs text-muted-foreground mt-1">Check balance and transactions</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
