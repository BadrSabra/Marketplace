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
    queryKey: ["/api/products", { storeId: myStore?.id }],
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
      queryClient.invalidateQueries({ queryKey: ["/api/products", { storeId: myStore?.id }] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({ title: "Status Updated", description: "The order status has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Update Failed", 
        description: error.message || "Failed to update order status.",
        variant: "destructive"
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
      ACCEPTED: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
      READY: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
      PICKED_UP: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800",
      DELIVERED: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
      CANCELLED: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    };
    return <Badge variant="outline" className={variants[status] || ""}>{status}</Badge>;
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
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "amount-desc":
          return parseFloat(b.subtotal) - parseFloat(a.subtotal);
        case "amount-asc":
          return parseFloat(a.subtotal) - parseFloat(b.subtotal);
        case "date-desc":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Order Management</h1>
          <p className="text-muted-foreground">Monitor and process incoming orders for your store.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Search Orders</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by customer or ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-full md:w-48 space-y-2">
            <label className="text-sm font-medium">Status Filter</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="READY">Ready</SelectItem>
                <SelectItem value="PICKED_UP">Picked Up</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48 space-y-2">
            <label className="text-sm font-medium">Sort By</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Newest First" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest First</SelectItem>
                <SelectItem value="date-asc">Oldest First</SelectItem>
                <SelectItem value="amount-desc">Highest Amount</SelectItem>
                <SelectItem value="amount-asc">Lowest Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Active Orders
            </CardTitle>
            <CardDescription>
              Orders that require fulfillment or are currently in progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Info</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                        No orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubOrders.map((sub: any) => (
                      <TableRow key={sub.sub_order_id} className="group">
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs font-bold text-primary">#{sub.sub_order_id.split("-")[0]}</span>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(sub.createdAt), "MMM d, HH:mm")}</span>
                            <Link href={`/store/order/${sub.parent_id}`}>
                              <Button variant="link" size="sm" className="p-0 h-auto text-[11px] justify-start">View Details</Button>
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{sub.customer_name}</TableCell>
                        <TableCell>
                          <div className="max-w-[200px] space-y-1">
                            {sub.items.length === 0 ? (
                              <span className="text-xs italic text-muted-foreground">No items</span>
                            ) : (
                              sub.items.map((item: any, idx: number) => {
                                const product = products?.find(p => p.id === item.product_id);
                                const isLowStock = product && product.stock < 5;
                                return (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
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
                        <TableCell className="font-bold whitespace-nowrap">${sub.subtotal}</TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {sub.status === "PENDING" && (
                              <>
                                <Button 
                                  size="sm" 
                                  className="h-8"
                                  onClick={() => statusMutation.mutate({ id: sub.sub_order_id, status: "ACCEPTED" })}
                                  disabled={statusMutation.isPending}
                                >
                                  <Check className="h-4 w-4 mr-1" /> Accept
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  className="h-8"
                                  onClick={() => statusMutation.mutate({ id: sub.sub_order_id, status: "CANCELLED" })}
                                  disabled={statusMutation.isPending}
                                >
                                  <X className="h-4 w-4 mr-1" /> Cancel
                                </Button>
                              </>
                            )}
                            {sub.status === "ACCEPTED" && (
                              <Button 
                                size="sm" 
                                className="bg-purple-600 hover:bg-purple-700 h-8 text-white"
                                onClick={() => statusMutation.mutate({ id: sub.sub_order_id, status: "READY" })}
                                disabled={statusMutation.isPending}
                              >
                                <Clock className="h-4 w-4 mr-1" /> Mark READY
                              </Button>
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
