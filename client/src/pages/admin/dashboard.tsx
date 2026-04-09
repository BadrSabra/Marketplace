import { AdminLayout } from "@/components/layout/admin-layout";
import { DataCard } from "@/components/ui/data-card";
import { Users, Store, Package, ShoppingCart, DollarSign, Activity, History } from "lucide-react";
import { useUsers } from "@/hooks/use-users";
import { useStores } from "@/hooks/use-stores";
import { useProducts } from "@/hooks/use-products";
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

  const { data: adminOrders, isLoading: loadingOrders } = useQuery<any[]>({
    queryKey: ["/api/admin/orders"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/orders");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/stats");
      if (!res.ok) return null;
      return res.json();
    }
  });

  const { data: ledgerData, isLoading: loadingLedger } = useQuery<{ transactions: any[]; total: number }>({
    queryKey: ["/api/ledger/transactions"],
    queryFn: async () => {
      const res = await apiFetch("/api/ledger/transactions");
      if (!res.ok) return { transactions: [], total: 0 };
      return res.json();
    },
  });

  const transactions = ledgerData?.transactions ?? [];
  const orders = Array.isArray(adminOrders) ? adminOrders : [];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "تم تحديث الحالة بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "فشل تحديث الحالة", description: error.message, variant: "destructive" });
    },
  });

  const totalUsers = stats?.totalUsers ?? users?.length ?? 0;
  const totalStores = stats?.totalStores ?? stores?.length ?? 0;
  const totalProducts = products?.length ?? 0;
  const totalOrders = stats?.totalOrders ?? orders.length ?? 0;
  const totalRevenue = stats?.totalRevenue ?? "0.00";

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">لوحة تحكم المشرف</h1>
        <p className="text-muted-foreground mt-2">مراقبة المتاجر والطلبات والعمليات المالية.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <DataCard 
          title="إجمالي المستخدمين" 
          value={loadingUsers || loadingStats ? "-" : totalUsers} 
          icon={<Users className="w-6 h-6" />}
        />
        <DataCard 
          title="المتاجر النشطة" 
          value={loadingStores || loadingStats ? "-" : totalStores} 
          icon={<Store className="w-6 h-6" />}
        />
        <DataCard 
          title="المنتجات" 
          value={loadingProducts ? "-" : totalProducts} 
          icon={<Package className="w-6 h-6" />}
        />
        <DataCard 
          title="إجمالي الطلبات" 
          value={loadingOrders || loadingStats ? "-" : totalOrders} 
          icon={<ShoppingCart className="w-6 h-6" />}
        />
        <DataCard 
          title="الإيرادات" 
          value={loadingStats ? "-" : `${totalRevenue} ج.م`} 
          icon={<DollarSign className="w-6 h-6" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card rounded-2xl p-6 premium-shadow border border-border/40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              الطلبات الأخيرة والتحكم
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>معرف الطلب</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOrders ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs">
                      لا توجد طلبات حتى الآن.
                    </TableCell>
                  </TableRow>
                ) : (
                  // BUG-FIX: Was rendering `order.overallStatus` as raw English enum ("PENDING", "DELIVERED", etc.)
                  // Now translated to Arabic labels.
                  orders.slice(0, 5).map((order: any) => {
                    const orderStatusLabels: Record<string, string> = {
                      PENDING: "في الانتظار", ACCEPTED: "مقبول", IN_TRANSIT: "في الطريق",
                      DELIVERED: "تم التوصيل", CANCELLED: "ملغي",
                    };
                    return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs truncate max-w-[80px]">{order.id?.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant={order.overallStatus === "DELIVERED" ? "default" : "secondary"}>
                          {orderStatusLabels[order.overallStatus] ?? order.overallStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.totalPrice} ج.م</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => updateStatusMutation.mutate({ id: order.id, status: "CANCELLED" })}
                          >
                            إلغاء
                          </Button>
                          <Button 
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => updateStatusMutation.mutate({ id: order.id, status: "DELIVERED" })}
                          >
                            تسليم
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  }))
                }
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 premium-shadow border border-border/40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              النشاط المالي
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النوع</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLedger ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-xs">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-xs">
                      لا توجد معاملات مالية.
                    </TableCell>
                  </TableRow>
                ) : (
                  // BUG-FIX: Was rendering `tx.type` and `tx.status` as raw English enum strings.
                  // Both are now translated to Arabic.
                  transactions.slice(0, 5).map((tx: any) => {
                    const typeLabels: Record<string, string> = {
                      DEPOSIT: "إيداع", WITHDRAWAL: "سحب", COMMISSION: "عمولة", REFUND: "استرداد",
                    };
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">{typeLabels[tx.type] ?? tx.type}</TableCell>
                        <TableCell className="text-sm font-medium">{tx.amount} ج.م</TableCell>
                        <TableCell>
                          <Badge variant={tx.status === "COMPLETED" ? "default" : "secondary"} className="text-[10px] px-1 h-4">
                            {tx.status === "COMPLETED" ? "مكتمل" : tx.status === "PENDING" ? "معلق" : tx.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
