import { AdminLayout } from "@/components/layout/admin-layout";
import { DataCard } from "@/components/ui/data-card";
import { Users, Store, Package, ShoppingCart } from "lucide-react";
import { useUsers } from "@/hooks/use-users";
import { useStores } from "@/hooks/use-stores";
import { useProducts } from "@/hooks/use-products";
import { useOrders } from "@/hooks/use-orders";

export default function Dashboard() {
  const { data: users, isLoading: loadingUsers } = useUsers();
  const { data: stores, isLoading: loadingStores } = useStores();
  const { data: products, isLoading: loadingProducts } = useProducts();
  const { data: orders, isLoading: loadingOrders } = useOrders();

  const totalUsers = users?.length || 0;
  const totalStores = stores?.length || 0;
  const totalProducts = products?.length || 0;
  const totalOrders = orders?.length || 0;

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-2">Welcome back. Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <DataCard 
          title="Total Users" 
          value={loadingUsers ? "-" : totalUsers} 
          icon={<Users className="w-6 h-6" />}
          trend="12% from last month"
          trendUp={true}
        />
        <DataCard 
          title="Active Stores" 
          value={loadingStores ? "-" : totalStores} 
          icon={<Store className="w-6 h-6" />}
          trend="4% from last month"
          trendUp={true}
        />
        <DataCard 
          title="Products Listed" 
          value={loadingProducts ? "-" : totalProducts} 
          icon={<Package className="w-6 h-6" />}
        />
        <DataCard 
          title="Total Orders" 
          value={loadingOrders ? "-" : totalOrders} 
          icon={<ShoppingCart className="w-6 h-6" />}
          trend="2% from yesterday"
          trendUp={false}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-6 premium-shadow border border-border/40">
          <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm italic">Connect real-time activity stream here.</p>
            {/* Placeholder for activity feed */}
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">New order placed</p>
                  <p className="text-xs text-muted-foreground">2 minutes ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 premium-shadow border border-border/40">
          <h3 className="text-lg font-bold mb-4">Platform Health</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Server Uptime</span>
                <span className="text-green-600">99.9%</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="w-full h-full bg-green-500 rounded-full" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Database Load</span>
                <span className="text-primary">24%</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="w-[24%] h-full bg-primary rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
