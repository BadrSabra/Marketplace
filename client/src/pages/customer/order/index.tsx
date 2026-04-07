import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Truck, User, Phone, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

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
    queryKey: [`/api/orders/${id}`],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950" dir="rtl">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950" dir="rtl">
        <Navbar />
        <div className="container mx-auto p-6 text-center flex-grow flex flex-col items-center justify-center">
          <Package className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
          <h1 className="text-2xl font-bold mb-2">الطلب غير موجود</h1>
          <p className="text-muted-foreground mb-6">الطلب الذي تبحث عنه غير موجود أو لا تملك صلاحية الوصول إليه.</p>
          <Link href="/customer/orders">
            <Button><ArrowRight className="h-4 w-4 ml-2" />العودة لطلباتي</Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentStepIndex = progressSteps.indexOf(order.overallStatus);
  const progressPercentage = ((currentStepIndex + 1) / progressSteps.length) * 100;

  const statusLabels: Record<string, string> = {
    PENDING: "في الانتظار",
    ACCEPTED: "تم القبول",
    READY: "جاهز للتوصيل",
    PICKED_UP: "تم الاستلام",
    DELIVERED: "تم التوصيل",
    CANCELLED: "ملغي",
    IN_TRANSIT: "في الطريق",
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950" dir="rtl">
      <Navbar />
      <main className="flex-grow container px-4 py-6 md:py-10 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/customer/orders">
            <Button variant="ghost" size="sm" className="gap-2 font-bold text-muted-foreground hover:text-foreground" data-testid="button-back-orders">
              <ChevronRight className="h-4 w-4" />
              طلباتي
            </Button>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-right">
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
              تفاصيل الطلب
              <Badge variant="outline" className="font-mono text-sm">
                #{order.id.slice(0, 8)}
              </Badge>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              تم تقديم الطلب في {format(new Date(order.createdAt), "dd/MM/yyyy")}
            </p>
          </div>
          <Badge className={`${statusColors[order.overallStatus] || "bg-gray-100"} text-sm px-4 py-1`}>
            {statusLabels[order.overallStatus] || order.overallStatus}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 flex-row-reverse text-right">
              <Truck className="h-5 w-5" /> تقدم التوصيل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progressPercentage} className="h-2" />
            <div className="grid grid-cols-5 text-center text-xs font-medium">
              {progressSteps.map((step, idx) => (
                <div key={step} className={idx <= currentStepIndex ? "text-primary font-bold" : "text-muted-foreground"}>
                  {statusLabels[step] || step}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {order.subOrders?.map((sub: any) => (
              <Card key={sub.id} data-testid={`card-suborder-${sub.id}`}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div className="text-right">
                      <CardTitle className="text-base">طلب فرعي #{sub.id.slice(0, 8)}</CardTitle>
                      <p className="text-sm text-muted-foreground">المتجر: {sub.store?.name || "متجر محلي"}</p>
                    </div>
                  </div>
                  <Badge className={statusColors[sub.status] || "bg-gray-100"}>
                    {statusLabels[sub.status] || sub.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  {sub.driver && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3 flex-row-reverse">
                      <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                        <Truck className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-800 dark:text-blue-300">{sub.driver.name}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 flex-row-reverse">
                          <Phone className="h-3 w-3" /> {sub.driver.phone}
                        </p>
                      </div>
                    </div>
                  )}
                  {sub.otpCode && (
                    <div className="mb-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-center">
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-1">رمز الاستلام</p>
                      <p className="text-3xl font-mono font-black tracking-[0.4em] text-amber-800 dark:text-amber-300">{sub.otpCode}</p>
                      <p className="text-xs text-muted-foreground mt-1">أعطِ هذا الرمز للسائق عند الاستلام</p>
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المنتج</TableHead>
                        <TableHead className="text-center">الكمية</TableHead>
                        <TableHead className="text-left">السعر</TableHead>
                        <TableHead className="text-left">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sub.items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-right">{item.product?.name || "منتج"}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-left">EGP {parseFloat(item.priceAtOrder).toFixed(2)}</TableCell>
                          <TableCell className="text-left">EGP {(item.quantity * parseFloat(item.priceAtOrder)).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex justify-start">
                    <p className="text-sm font-bold">الإجمالي الفرعي: EGP {parseFloat(sub.subtotal).toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-right">ملخص الدفع</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm flex-row-reverse">
                  <span className="text-muted-foreground">إجمالي الأصناف</span>
                  <span>EGP {parseFloat(order.totalPrice).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm flex-row-reverse">
                  <span className="text-muted-foreground">رسوم التوصيل</span>
                  <span>EGP 10.00</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg flex-row-reverse">
                  <span>الإجمالي</span>
                  <span>EGP {(parseFloat(order.totalPrice) + 10).toFixed(2)}</span>
                </div>
                <Badge variant="outline" className="w-full justify-center mt-2 py-1">
                  مدفوع عبر المحفظة
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
