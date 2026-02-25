import { AdminLayout } from "@/components/layout/admin-layout";
import { DataCard } from "@/components/ui/data-card";
import { Users, Store, Package, ShoppingCart, DollarSign, Activity, History } from "lucide-react";
import { useUsers } from "@/hooks/use-users";
import { useStores } from "@/hooks/use-stores";
import { useProducts } from "@/hooks/use-products";
import { useOrders } from "@/hooks/use-orders";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { toast } = useToast();
  const { data: users, isLoading: loadingUsers } = useUsers();
  const { data: stores, isLoading: loadingStores } = useStores();
  const { data: products, isLoading: loadingProducts } = useProducts();
  const { data: orders, isLoading: loadingOrders } = useOrders();

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/stats");
      return res.json();
    }
  });

  const { data: transactions, isLoading: loadingLedger } = useQuery<any[]>({
    queryKey: ["/api/ledger/transactions"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/suborders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Status updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const totalUsers = stats?.totalUsers ?? users?.length ?? 0;
  const totalStores = stats?.totalStores ?? stores?.length ?? 0;
  const totalProducts = products?.length ?? 0;
  const totalOrders = stats?.totalOrders ?? orders?.length ?? 0;
  const totalRevenue = stats?.totalRevenue ?? "0.00";

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Admin Oversight</h1>
        <p className="text-muted-foreground mt-2">Monitor stores, orders, and financial transactions.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <DataCard 
          title="Total Users" 
          value={loadingUsers || loadingStats ? "-" : totalUsers} 
          icon={<Users className="w-6 h-6" />}
        />
        <DataCard 
          title="Active Stores" 
          value={loadingStores || loadingStats ? "-" : totalStores} 
          icon={<Store className="w-6 h-6" />}
        />
        <DataCard 
          title="Products" 
          value={loadingProducts ? "-" : totalProducts} 
          icon={<Package className="w-6 h-6" />}
        />
        <DataCard 
          title="Total Orders" 
          value={loadingOrders || loadingStats ? "-" : totalOrders} 
          icon={<ShoppingCart className="w-6 h-6" />}
        />
        <DataCard 
          title="Revenue" 
          value={loadingStats ? "-" : `$${totalRevenue}`} 
          icon={<DollarSign className="w-6 h-6" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card rounded-2xl p-6 premium-shadow border border-border/40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Orders & Control
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.slice(0, 5).map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs truncate max-w-[80px]">{order.id}</TableCell>
                    <TableCell>
                      <Badge variant={order.overallStatus === "DELIVERED" ? "default" : "secondary"}>
                        {order.overallStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>${order.totalPrice}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => updateStatusMutation.mutate({ id: order.id, status: "CANCELLED" })}
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => updateStatusMutation.mutate({ id: order.id, status: "DELIVERED" })}
                        >
                          Force
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 premium-shadow border border-border/40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Financial Activity
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions?.slice(0, 5).map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">{tx.type}</TableCell>
                    <TableCell className="text-sm font-medium">${tx.amount}</TableCell>
                    <TableCell>
                      <Badge variant={tx.status === "COMPLETED" ? "default" : "secondary"} className="text-[10px] px-1 h-4">
                        {tx.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!transactions || transactions.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-xs">
                      No recent transactions.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

