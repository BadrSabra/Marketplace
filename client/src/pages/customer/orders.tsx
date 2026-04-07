import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ChevronLeft, Clock, CheckCircle2, Truck, XCircle } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ACCEPTED: "bg-blue-100 text-blue-800 border-blue-200",
  READY: "bg-purple-100 text-purple-800 border-purple-200",
  IN_TRANSIT: "bg-cyan-100 text-cyan-800 border-cyan-200",
  PICKED_UP: "bg-cyan-100 text-cyan-800 border-cyan-200",
  DELIVERED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

const statusLabels: Record<string, string> = {
  PENDING: "في الانتظار",
  ACCEPTED: "تم القبول",
  READY: "جاهز للتوصيل",
  IN_TRANSIT: "في الطريق",
  PICKED_UP: "تم الاستلام",
  DELIVERED: "تم التوصيل",
  CANCELLED: "ملغي",
};

const statusIcons: Record<string, any> = {
  PENDING: Clock,
  ACCEPTED: CheckCircle2,
  READY: Package,
  IN_TRANSIT: Truck,
  PICKED_UP: Truck,
  DELIVERED: CheckCircle2,
  CANCELLED: XCircle,
};

function OrderSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border space-y-3">
          <Skeleton className="h-5 w-1/3 mr-auto" />
          <Skeleton className="h-4 w-1/2 mr-auto" />
          <Skeleton className="h-8 w-24 mr-auto" />
        </div>
      ))}
    </div>
  );
}

function getEffectiveOrderStatus(order: any): string {
  const subs = order.subOrders || order.sub_orders || [];
  if (subs.length === 0) return order.overallStatus || "PENDING";
  const allDelivered = subs.every((s: any) => s.status === "DELIVERED");
  const allCancelled = subs.every((s: any) => s.status === "CANCELLED");
  const allDone = subs.every((s: any) => s.status === "DELIVERED" || s.status === "CANCELLED");
  if (allDelivered) return "DELIVERED";
  if (allCancelled) return "CANCELLED";
  if (allDone) return "DELIVERED";
  const hasInTransit = subs.some((s: any) => s.status === "IN_TRANSIT");
  if (hasInTransit) return "IN_TRANSIT";
  const hasAccepted = subs.some((s: any) => s.status === "ACCEPTED");
  if (hasAccepted) return "ACCEPTED";
  return order.overallStatus || "PENDING";
}

export default function CustomerOrders() {
  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/orders/my-orders"],
    refetchInterval: 30000,
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950" dir="rtl">
      <Navbar />

      <main className="flex-grow container px-4 py-6 md:py-10 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-black">طلباتي</h1>
          {orders.length > 0 && (
            <Badge className="text-sm px-3">{orders.length} طلب</Badge>
          )}
        </div>

        {isLoading ? (
          <OrderSkeleton />
        ) : orders.length === 0 ? (
          <div
            className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border-dashed border-2"
            data-testid="text-empty-orders"
          >
            <div className="bg-slate-100 dark:bg-slate-800 h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="h-10 w-10 text-muted-foreground opacity-30" />
            </div>
            <h2 className="text-xl font-bold mb-2">لا توجد طلبات بعد</h2>
            <p className="text-muted-foreground mb-6">اطلب من متاجرنا المحلية وستجد طلباتك هنا</p>
            <Link href="/">
              <Button className="px-8 font-bold" data-testid="button-start-shopping">
                تصفح المتاجر
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => {
              const overallStatus = getEffectiveOrderStatus(order);
              const Icon = statusIcons[overallStatus] || Package;
              const hasActiveSubOrders = order.subOrders?.some(
                (s: any) => !["DELIVERED", "CANCELLED"].includes(s.status)
              );

              return (
                <Card
                  key={order.id}
                  className={`hover:shadow-md transition-all border-2 ${hasActiveSubOrders ? "border-primary/20" : "border-transparent"}`}
                  data-testid={`card-order-${order.id}`}
                >
                  <CardContent className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-grow text-right">
                        <div className="flex items-center gap-2 flex-row-reverse mb-1">
                          <p className="font-black text-base">
                            طلب #{order.id.slice(0, 8)}
                          </p>
                          <Badge
                            className={`${statusColors[overallStatus] || "bg-gray-100"} text-xs shrink-0`}
                          >
                            <Icon className="h-3 w-3 ml-1" />
                            {statusLabels[overallStatus] || overallStatus}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground mb-3">
                          {format(new Date(order.createdAt), "dd/MM/yyyy - HH:mm")}
                        </p>

                        {order.subOrders && order.subOrders.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3 flex-row-reverse">
                            {order.subOrders.map((sub: any) => (
                              <div
                                key={sub.id}
                                className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1"
                              >
                                <span className="text-xs font-medium">
                                  {sub.store?.name || "متجر محلي"}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1 py-0 ${statusColors[sub.status] || ""}`}
                                >
                                  {statusLabels[sub.status] || sub.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between flex-row-reverse">
                          <p className="text-sm font-bold text-primary">
                            EGP {parseFloat(order.totalPrice).toFixed(2)}
                          </p>
                          <Link href={`/customer/order/${order.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs font-bold border-2 hover:border-primary/50 hover:text-primary"
                              data-testid={`button-view-order-${order.id}`}
                            >
                              التفاصيل
                              <ChevronLeft className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
