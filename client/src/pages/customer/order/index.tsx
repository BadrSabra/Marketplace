import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Truck, User, Phone, MapPin, CheckCircle2, Clock, XCircle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ACCEPTED: "bg-blue-100 text-blue-800 border-blue-200",
  READY: "bg-purple-100 text-purple-800 border-purple-200",
  PICKED_UP: "bg-cyan-100 text-cyan-800 border-cyan-200",
  DELIVERED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

const progressSteps = ["PENDING", "ACCEPTED", "READY", "PICKED_UP", "DELIVERED"];

export default function CustomerOrderDetails() {
  const { id } = useParams();

  const { data: order, isLoading, error } = useQuery<any>({
    queryKey: ["/api/orders", id],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold text-red-600">Order not found</h1>
        <p className="text-muted-foreground mt-2">The order you are looking for does not exist or you don't have permission to view it.</p>
      </div>
    );
  }

  const currentStepIndex = progressSteps.indexOf(order.overallStatus);
  const progressPercentage = ((currentStepIndex + 1) / progressSteps.length) * 100;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            Order Details
            <Badge variant="outline" className="font-mono text-sm ml-2">
              #{order.id.slice(0, 8)}
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            Placed on {format(new Date(order.createdAt), "PPP 'at' p")}
          </p>
        </div>
        <Badge className={statusColors[order.overallStatus] || "bg-gray-100"}>
          {order.overallStatus}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" /> Delivery Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress value={progressPercentage} className="h-2" />
          <div className="grid grid-cols-5 text-center text-xs font-medium">
            {progressSteps.map((step, idx) => (
              <div key={step} className={idx <= currentStepIndex ? "text-primary" : "text-muted-foreground"}>
                {step.replace("_", " ")}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {order.subOrders?.map((sub: any) => (
            <Card key={sub.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Sub-Order #{sub.id.slice(0, 8)}</CardTitle>
                    <p className="text-sm text-muted-foreground">Store: {sub.store?.name || "Local Store"}</p>
                  </div>
                </div>
                <Badge className={statusColors[sub.status]}>{sub.status}</Badge>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sub.items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product?.name || "Product"}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">${parseFloat(item.priceAtOrder).toFixed(2)}</TableCell>
                        <TableCell className="text-right">${(item.quantity * parseFloat(item.priceAtOrder)).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end">
                  <p className="text-sm font-bold">Subtotal: ${parseFloat(sub.subtotal).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" /> Delivery Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.deliveryInfo?.driver ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{order.deliveryInfo.driver.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {order.deliveryInfo.driver.phone}
                      </p>
                    </div>
                  </div>
                  {order.deliveryInfo.otp && (
                    <div className="bg-primary/5 p-3 rounded-md border border-primary/20 text-center">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Security OTP</p>
                      <p className="text-2xl font-mono font-bold tracking-widest text-primary">{order.deliveryInfo.otp}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center italic">
                  Waiting for driver assignment...
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items Total</span>
                <span>${parseFloat(order.totalPrice).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span>$10.00</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${(parseFloat(order.totalPrice) + 10).toFixed(2)}</span>
              </div>
              <Badge variant="outline" className="w-full justify-center mt-2 py-1">
                Paid via Wallet
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
