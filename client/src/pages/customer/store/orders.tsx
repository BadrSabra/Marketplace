import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, Package, X, Clock, AlertTriangle, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { StoreLayout } from "@/components/layout/store-layout";
import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from '@/i18n';

export default function StoreOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date-desc");

  const { data: stores } = useQuery<any[]>({
    queryKey: ["/api/stores"],
  });
  
  const myStore = stores?.find(s => s.ownerId === user?.id);

  const { data: products } = useQuery<any[]>({
    queryKey: [`/api/products?store_id=${myStore?.id}`],
    enabled: !!myStore?.id,
  });

  const { data: orders, isLoading } = useQuery<any[]>({
    queryKey: ["/api/orders/my-store"],
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/suborders/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my-store"] });
      queryClient.invalidateQueries({ queryKey: [`/api/products?store_id=${myStore?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({ 
        title: t('store.orders.toasts.success_title'), 
        description: t('store.orders.toasts.success_desc') 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: t('store.orders.toasts.error_title'), 
        description: error.message || t('store.orders.toasts.error_desc'),
        variant: "destructive"
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
      ACCEPTED: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
      IN_TRANSIT: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
      DELIVERED: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
      CANCELLED: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    };
    return <Badge variant="outline" className={variants[status] || ""}>{t(`store.orders.statuses.${status}`)}</Badge>;
  };

  const filteredSubOrders = useMemo(() => {
    if (!orders) return [];
    
    let flattened = orders.flatMap(order => 
      order.sub_orders.map((sub: any) => ({
        ...sub,
        customer_name: order.customer_name,
        parent_id: order.order_id,
        parent_createdAt: order.createdAt
      }))
    );

    // Filter
    if (statusFilter !== "ALL") {
      flattened = flattened.filter(sub => sub.status === statusFilter);
    }
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      flattened = flattened.filter(sub => 
        sub.customer_name.toLowerCase().includes(lowSearch) || 
        sub.sub_order_id.toLowerCase().includes(lowSearch)
      );
    }

    // Sort
    flattened.sort((a, b) => {
      switch (sortBy) {
        case "date-asc":
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case "amount-desc":
          return parseFloat(b.subtotal) - parseFloat(a.subtotal);
        case "amount-asc":
          return parseFloat(a.subtotal) - parseFloat(b.subtotal);
        case "date-desc":
        default:
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
    });

    return flattened;
  }, [orders, statusFilter, searchTerm, sortBy]);

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="space-y-6 rtl:text-right" dir="auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('store.orders.title')}</h1>
          <p className="text-muted-foreground">{t('store.orders.subtitle')}</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end rtl:flex-row-reverse">
          <div className="flex-1 space-y-2 rtl:text-right">
            <label className="text-sm font-medium">{t('store.orders.search_label')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
              <Input 
                placeholder={t('store.orders.search_placeholder')} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rtl:pl-10 rtl:pr-3"
              />
            </div>
          </div>
          <div className="w-full md:w-48 space-y-2 rtl:text-right">
            <label className="text-sm font-medium">{t('store.orders.status_filter')}</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('store.orders.statuses.ALL')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('store.orders.statuses.ALL')}</SelectItem>
                <SelectItem value="PENDING">{t('store.orders.statuses.PENDING')}</SelectItem>
                <SelectItem value="ACCEPTED">{t('store.orders.statuses.ACCEPTED')}</SelectItem>
                <SelectItem value="IN_TRANSIT">{t('store.orders.statuses.IN_TRANSIT')}</SelectItem>
                <SelectItem value="DELIVERED">{t('store.orders.statuses.DELIVERED')}</SelectItem>
                <SelectItem value="CANCELLED">{t('store.orders.statuses.CANCELLED')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48 space-y-2 rtl:text-right">
            <label className="text-sm font-medium">{t('store.orders.sort_by')}</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder={t('store.orders.sort_options.date_desc')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">{t('store.orders.sort_options.date_desc')}</SelectItem>
                <SelectItem value="date-asc">{t('store.orders.sort_options.date_asc')}</SelectItem>
                <SelectItem value="amount-desc">{t('store.orders.sort_options.amount_desc')}</SelectItem>
                <SelectItem value="amount-asc">{t('store.orders.sort_options.amount_asc')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader className="rtl:text-right">
            <CardTitle className="flex items-center gap-2 rtl:flex-row-reverse">
              <Package className="h-5 w-5 text-primary" />
              {t('store.orders.active_orders')}
            </CardTitle>
            <CardDescription>
              {t('store.orders.orders_description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="rtl:flex-row-reverse">
                    <TableHead className="rtl:text-right">{t('store.orders.table.info')}</TableHead>
                    <TableHead className="rtl:text-right">{t('store.orders.table.customer')}</TableHead>
                    <TableHead className="rtl:text-right">{t('store.orders.table.items')}</TableHead>
                    <TableHead className="rtl:text-right">{t('store.orders.table.total')}</TableHead>
                    <TableHead className="rtl:text-right">{t('store.orders.table.status')}</TableHead>
                    <TableHead className="text-right rtl:text-left">{t('store.orders.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                        {t('store.orders.no_orders')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubOrders.map((sub: any) => (
                      <TableRow key={sub.sub_order_id} className="group rtl:flex-row-reverse">
                        <TableCell className="rtl:text-right">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs font-bold text-primary">#{sub.sub_order_id.split("-")[0]}</span>
                            <span className="text-[10px] text-muted-foreground">{sub.createdAt ? format(new Date(sub.createdAt), "MMM d, HH:mm") : "-"}</span>
                            <Link href={`/store/order/${sub.parent_id}`}>
                              <Button variant="ghost" size="sm" className="p-0 h-auto text-[11px] justify-start rtl:justify-end">{t('store.orders.view_details')}</Button>
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium rtl:text-right">{sub.customer_name}</TableCell>
                        <TableCell className="rtl:text-right">
                          <div className="max-w-[200px] space-y-1">
                            {sub.items.length === 0 ? (
                              <span className="text-xs italic text-muted-foreground">{t('store.orders.no_items')}</span>
                            ) : (
                              sub.items.map((item: any, idx: number) => {
                                const product = products?.find(p => p.id === item.product_id);
                                const isLowStock = product && product.stock < 5;
                                return (
                                  <div key={idx} className="flex items-center gap-2 text-xs rtl:flex-row-reverse">
                                    <span className="text-muted-foreground font-mono bg-muted px-1 rounded">{item.quantity}x</span>
                                    <span className="truncate">{item.product_name}</span>
                                    {isLowStock && (
                                      <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold whitespace-nowrap rtl:text-right">{parseFloat(sub.subtotal || "0").toFixed(2)} جنيه</TableCell>
                        <TableCell className="rtl:text-right">{getStatusBadge(sub.status)}</TableCell>
                        <TableCell className="text-right rtl:text-left">
                          <div className="flex justify-end gap-2 rtl:flex-row-reverse">
                            {sub.status === "PENDING" && (
                              <>
                                <Button 
                                  size="sm" 
                                  className="h-8"
                                  onClick={() => statusMutation.mutate({ id: sub.sub_order_id, status: "ACCEPTED" })}
                                  disabled={statusMutation.isPending}
                                >
                                  <Check className="h-4 w-4 ml-1 rtl:ml-0 rtl:mr-1" /> {t('store.orders.actions.accept')}
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  className="h-8"
                                  onClick={() => statusMutation.mutate({ id: sub.sub_order_id, status: "CANCELLED" })}
                                  disabled={statusMutation.isPending}
                                >
                                  <X className="h-4 w-4 ml-1 rtl:ml-0 rtl:mr-1" /> {t('store.orders.actions.cancel')}
                                </Button>
                              </>
                            )}
                            {sub.status === "ACCEPTED" && (
                              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-1.5 font-medium">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>مقبول - في انتظار السائق</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </StoreLayout>
  );
}
