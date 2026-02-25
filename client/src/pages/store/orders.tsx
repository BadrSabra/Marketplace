import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, Package, X, Clock } from "lucide-react";
import { format } from "date-fns";

export default function StoreOrders() {
  const { toast } = useToast();

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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      ACCEPTED: "bg-blue-100 text-blue-800",
      READY: "bg-purple-100 text-purple-800",
      PICKED_UP: "bg-cyan-100 text-cyan-800",
      DELIVERED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return <Badge className={variants[status] || ""}>{status}</Badge>;
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Incoming Orders</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Active Sub-Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
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
              {allSubOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No orders found.
                  </TableCell>
                </TableRow>
              ) : (
                allSubOrders.map((sub: any) => (
                  <TableRow key={sub.sub_order_id}>
                    <TableCell>
                      <div className="text-xs font-mono text-muted-foreground">
                        ID: {sub.sub_order_id.split("-")[0]}...
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{sub.customer_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {sub.items.map((item: any, idx: number) => (
                          <div key={idx}>
                            {item.quantity}x {item.product_name}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>${sub.subtotal}</TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {sub.status === "PENDING" && (
                          <>
                            <Button 
                              size="sm" 
                              onClick={() => statusMutation.mutate({ id: sub.sub_order_id, status: "ACCEPTED" })}
                              disabled={statusMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" /> Accept
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
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
                            className="bg-purple-600 hover:bg-purple-700"
                            onClick={() => statusMutation.mutate({ id: sub.sub_order_id, status: "READY" })}
                            disabled={statusMutation.isPending}
                          >
                            <Clock className="h-4 w-4 mr-1" /> Mark Ready
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
  );
}
