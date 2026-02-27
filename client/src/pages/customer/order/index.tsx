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
    <div className="container mx-auto p-6 space-y-6 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-row-reverse">
        <div className="text-right">
          <h1 className="text-3xl font-bold flex items-center gap-2 flex-row-reverse">
            {t('store.order_details.title')}
            <Badge variant="outline" className="font-mono text-sm mr-2 ml-0">
              #{order.id.slice(0, 8)}
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            {t('store.order_details.order_placed_on') || 'تم تقديم الطلب في'} {format(new Date(order.createdAt), "PPP 'at' p")}
          </p>
        </div>
        <Badge className={statusColors[order.overallStatus] || "bg-gray-100"}>
          {t(`store.orders.statuses.${order.overallStatus}`)}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 flex-row-reverse text-right">
            <Truck className="h-5 w-5" /> {t('driver.active_delivery.delivery_progress') || 'تقدم التوصيل'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress value={progressPercentage} className="h-2" />
          <div className="grid grid-cols-5 text-center text-xs font-medium flex-row-reverse">
            {progressSteps.map((step, idx) => (
              <div key={step} className={idx <= currentStepIndex ? "text-primary" : "text-muted-foreground"}>
                {t(`store.orders.statuses.${step}`)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6 flex-row-reverse">
        <div className="md:col-span-2 space-y-6">
          {order.subOrders?.map((sub: any) => (
            <Card key={sub.id}>
              <CardHeader className="flex flex-row items-center justify-between flex-row-reverse">
                <div className="flex items-center gap-2 flex-row-reverse">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div className="text-right">
                    <CardTitle className="text-base">{t('store.order_details.sub_order_number')} #{sub.id.slice(0, 8)}</CardTitle>
                    <p className="text-sm text-muted-foreground">{t('customer.dashboard.store')}: {sub.store?.name || "Local Store"}</p>
                  </div>
                </div>
                <Badge className={statusColors[sub.status]}>{t(`store.orders.statuses.${sub.status}`)}</Badge>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="flex-row-reverse">
                      <TableHead className="text-right">{t('store.order_details.table.product')}</TableHead>
                      <TableHead className="text-center">{t('store.order_details.table.qty')}</TableHead>
                      <TableHead className="text-left">{t('store.order_details.table.price')}</TableHead>
                      <TableHead className="text-left">{t('store.order_details.table.total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sub.items?.map((item: any) => (
                      <TableRow key={item.id} className="flex-row-reverse">
                        <TableCell className="font-medium text-right">{item.product?.name || "Product"}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-left">${parseFloat(item.priceAtOrder).toFixed(2)}</TableCell>
                        <TableCell className="text-left">${(item.quantity * parseFloat(item.priceAtOrder)).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end flex-row-reverse">
                  <p className="text-sm font-bold">{t('store.order_details.subtotal')}: ${parseFloat(sub.subtotal).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 flex-row-reverse text-right">
                <User className="h-5 w-5" /> {t('store.order_details.customer_info')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.deliveryInfo?.driver ? (
                <>
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{order.deliveryInfo.driver.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 flex-row-reverse">
                        <Phone className="h-3 w-3" /> {order.deliveryInfo.driver.phone}
                      </p>
                    </div>
                  </div>
                  {order.deliveryInfo.otp && (
                    <div className="bg-primary/5 p-3 rounded-md border border-primary/20 text-center">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">{t('driver.active_delivery.delivery_otp')}</p>
                      <p className="text-2xl font-mono font-bold tracking-widest text-primary">{order.deliveryInfo.otp}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center italic">
                  {t('store.order_details.waiting_for_driver') || 'في انتظار تعيين سائق...'}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-right">{t('store.order_details.payment_summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm flex-row-reverse">
                <span className="text-muted-foreground">{t('store.order_details.items_total') || 'إجمالي الأصناف'}</span>
                <span>${parseFloat(order.totalPrice).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm flex-row-reverse">
                <span className="text-muted-foreground">{t('store.order_details.delivery_fee') || 'رسوم التوصيل'}</span>
                <span>$10.00</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg flex-row-reverse">
                <span>{t('store.order_details.total_price')}</span>
                <span>${(parseFloat(order.totalPrice) + 10).toFixed(2)}</span>
              </div>
              <Badge variant="outline" className="w-full justify-center mt-2 py-1">
                {t('store.order_details.paid_via_wallet') || 'مدفوع عبر المحفظة'}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
