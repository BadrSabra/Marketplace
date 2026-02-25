import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, Package, X, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { StoreLayout } from "@/components/layout/store-layout";
import { useAuth } from "@/hooks/use-auth";

export default function StoreOrders() {
  const { user } = useAuth();
  const { toast } = useToast();

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

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
      ACCEPTED: "bg-blue-100 text-blue-800 border-blue-200",
      READY: "bg-purple-100 text-purple-800 border-purple-200",
      PICKED_UP: "bg-cyan-100 text-cyan-800 border-cyan-200",
      DELIVERED: "bg-green-100 text-green-800 border-green-200",
      CANCELLED: "bg-red-100 text-red-800 border-red-200",
    };
    return <Badge variant="outline" className={variants[status] || ""}>{status}</Badge>;
  };

  // Flatten sub-orders for the table
  const allSubOrders = orders?.flatMap(order => 
    order.sub_orders.map((sub: any) => ({
      ...sub,
      customer_name: order.customer_name,
      parent_id: order.order_id
    }))
  ) || [];

  return (
    <StoreLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Order Management</h1>
          <p className="text-muted-foreground">Monitor and process incoming orders for your store.</p>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSubOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                      No active orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  allSubOrders.map((sub: any) => (
                    <TableRow key={sub.sub_order_id} className="group">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-muted-foreground">#{sub.sub_order_id.split("-")[0]}</span>
                          <Link href={`/store/order/${sub.parent_id}`}>
                            <Button variant="link" size="sm" className="p-0 h-auto text-primary font-bold">Details</Button>
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{sub.customer_name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {sub.items.map((item: any, idx: number) => {
                            const product = products?.find(p => p.id === item.product_id);
                            const isLowStock = product && product.stock < 5;
                            return (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground font-mono">{item.quantity}x</span>
                                <span>{item.product_name}</span>
                                {isLowStock && (
                                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">${sub.subtotal}</TableCell>
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
                                <X className="h-4 w-4 mr-1" />
                              </Button>
                            </>
                          )}
                          {sub.status === "ACCEPTED" && (
                            <Button 
                              size="sm" 
                              className="bg-purple-600 hover:bg-purple-700 h-8"
                              onClick={() => statusMutation.mutate({ id: sub.sub_order_id, status: "READY" })}
                              disabled={statusMutation.isPending}
                            >
                              <Clock className="h-4 w-4 mr-1" /> Ready
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </StoreLayout>
  );
}
