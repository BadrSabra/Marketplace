import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, Package, X, Clock, ArrowLeft, User, MapPin, Phone, Mail, CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function StoreOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data: order, isLoading } = useQuery<any>({
    queryKey: [`/api/orders/${id}`],
  });

  const { data: wallet } = useQuery<any>({
    queryKey: ["/api/wallet"],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ subOrderId, status }: { subOrderId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/suborders/${subOrderId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
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

  if (!order) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Order not found</h2>
          <Link href="/store/dashboard/orders">
            <Button variant="link">Back to Orders</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      ACCEPTED: "bg-blue-100 text-blue-800",
      READY: "bg-purple-100 text-purple-800",
      PICKED_UP: "bg-cyan-100 text-cyan-800",
      DELIVERED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return <Badge className={variants[status] || ""}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/store/dashboard/orders">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Order Details</h1>
          <p className="text-muted-foreground">Order ID: {id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Sub-orders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {order.sub_orders?.map((sub: any) => (
              <div key={sub.sub_order_id} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">Sub-order #{sub.sub_order_id.split("-")[0]}</h3>
                    <div className="flex gap-2 mt-1">
                      {getStatusBadge(sub.status)}
                      <Badge variant="outline">{order.payment_status}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Subtotal</p>
                    <p className="text-xl font-bold">${sub.subtotal}</p>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sub.items.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>${item.price_at_order}</TableCell>
                        <TableCell className="text-right">${(item.quantity * parseFloat(item.price_at_order)).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end gap-2">
                  {sub.status === "PENDING" && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => statusMutation.mutate({ subOrderId: sub.sub_order_id, status: "ACCEPTED" })}
                        disabled={statusMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" /> Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => statusMutation.mutate({ subOrderId: sub.sub_order_id, status: "CANCELLED" })}
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
                      onClick={() => statusMutation.mutate({ subOrderId: sub.sub_order_id, status: "READY" })}
                      disabled={statusMutation.isPending}
                    >
                      <Clock className="h-4 w-4 mr-1" /> Mark Ready
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.customer_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{order.customer_email || "No email provided"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{order.customer_phone || "No phone provided"}</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <span>{order.delivery_address || "No address provided"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Order Total</span>
                <span className="font-bold text-lg">${order.total_price}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-muted-foreground">Wallet Balance</span>
                <span className="font-mono text-green-600 font-bold">${wallet?.balance || "0.00"}</span>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Platform fees and commissions are calculated per sub-order.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
