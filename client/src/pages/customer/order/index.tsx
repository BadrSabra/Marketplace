import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Truck, Phone, ChevronRight, ArrowRight, CheckCircle, XCircle, Tag, ArrowLeftRight, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Q: لماذا أُزيلت حالتا READY وPICKED_UP من القواميس؟
// A: shared/schema.ts يُعرّف subOrderStatusEnum بالحالات الفعلية فقط:
//    PENDING, ACCEPTED, IN_TRANSIT, DELIVERED, CANCELLED.
//    READY وPICKED_UP لا وجود لهما في DB schema ولا في خدمات الخادم،
//    وإبقاؤهما كود ميت يُوهم المطورين بأن هذه الحالات صالحة وقائمة.
//    الإصلاح: حذفهما للتطابق الكامل مع schema الحقيقية.
const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ACCEPTED: "bg-blue-100 text-blue-800 border-blue-200",
  IN_TRANSIT: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DELIVERED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

const progressSteps = ["PENDING", "ACCEPTED", "IN_TRANSIT", "DELIVERED"];

const statusLabels: Record<string, string> = {
  PENDING: "في الانتظار",
  ACCEPTED: "تم القبول",
  IN_TRANSIT: "في الطريق",
  DELIVERED: "تم التوصيل",
  CANCELLED: "ملغي",
};

function getEffectiveStatus(order: any): string {
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

function DeliveryOffersSection({ subOrderId, orderId }: { subOrderId: string; orderId: string }) {
  const { toast } = useToast();
  const [counterDialog, setCounterDialog] = useState<{ open: boolean; offerId: string; originalFee: number } | null>(null);
  const [counterFeeInput, setCounterFeeInput] = useState("");

  const { data: offers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/delivery/suborders", subOrderId, "offers"],
    queryFn: async () => {
      // BUG-FIX: Was using raw fetch() with manual getAuthHeaders() + silent `if (!res.ok) return []`
      // which bypassed the 401→redirect-to-login logic in apiFetch and masked API errors as empty list.
      // apiFetch handles auth headers, throws on non-OK, and redirects to /login on 401.
      const res = await apiFetch(`/api/delivery/suborders/${subOrderId}/offers`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const res = await apiFetch(`/api/delivery/offers/${offerId}/accept`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم قبول عرض السائق", description: "تم خصم رسوم التوصيل من محفظتك. سيبدأ السائق التوصيل قريباً." });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/suborders", subOrderId, "offers"] });
    },
    onError: (error: Error) => {
      toast({ title: "فشل قبول العرض", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const res = await apiFetch(`/api/delivery/offers/${offerId}/reject`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم رفض العرض" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/suborders", subOrderId, "offers"] });
    },
    onError: (error: Error) => {
      toast({ title: "فشل رفض العرض", description: error.message, variant: "destructive" });
    },
  });

  const counterMutation = useMutation({
    mutationFn: async ({ offerId, counterFee }: { offerId: string; counterFee: number }) => {
      const res = await apiFetch(`/api/delivery/offers/${offerId}/counter`, {
        method: "POST",
        body: JSON.stringify({ counterFee }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إرسال العرض المضاد", description: "سيرى السائق اقتراحك وقد يقبل السعر الجديد." });
      setCounterDialog(null);
      setCounterFeeInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/suborders", subOrderId, "offers"] });
    },
    onError: (error: Error) => {
      toast({ title: "فشل إرسال العرض المضاد", description: error.message, variant: "destructive" });
    },
  });

  const handleCounterSubmit = () => {
    if (!counterDialog) return;
    const fee = parseFloat(counterFeeInput);
    if (!counterFeeInput || isNaN(fee) || fee <= 0) {
      toast({ title: "يرجى إدخال سعر صحيح", variant: "destructive" });
      return;
    }
    if (fee >= counterDialog.originalFee) {
      toast({ title: "يجب أن يكون العرض المضاد أقل من سعر السائق", variant: "destructive" });
      return;
    }
    counterMutation.mutate({ offerId: counterDialog.offerId, counterFee: fee });
  };

  if (isLoading) return null;
  if (!offers || offers.length === 0) return null;

  const isBusy = acceptMutation.isPending || rejectMutation.isPending || counterMutation.isPending;

  return (
    <>
      <div className="mt-4 border-t pt-4">
        <div className="flex items-center gap-2 mb-3 flex-row-reverse">
          <Tag className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-bold text-right">عروض التوصيل ({offers.length})</h4>
        </div>
        <p className="text-xs text-muted-foreground text-right mb-3">
          اختر أفضل عرض سعر للتوصيل أو قدّم سعراً مضاداً أقل. سيتم خصم رسوم التوصيل من محفظتك عند القبول.
        </p>
        <div className="space-y-3">
          {offers.map((offer: any) => {
            const isCountered = offer.status === "COUNTERED";
            return (
              <div
                key={offer.id}
                className={`p-3 border rounded-lg space-y-2 ${isCountered ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" : "bg-muted/50"}`}
                data-testid={`offer-row-${offer.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 flex-wrap">
                    {!isCountered && (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectMutation.mutate(offer.id)}
                          disabled={isBusy}
                          data-testid={`button-reject-offer-${offer.id}`}
                        >
                          <XCircle className="h-3 w-3 ml-1" />
                          رفض
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-600 dark:hover:bg-amber-950/30"
                          onClick={() => {
                            setCounterFeeInput("");
                            setCounterDialog({ open: true, offerId: offer.id, originalFee: parseFloat(offer.offeredFee) });
                          }}
                          disabled={isBusy}
                          data-testid={`button-counter-offer-${offer.id}`}
                        >
                          <ArrowLeftRight className="h-3 w-3 ml-1" />
                          سعر مضاد
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => acceptMutation.mutate(offer.id)}
                          disabled={isBusy}
                          data-testid={`button-accept-offer-${offer.id}`}
                        >
                          {acceptMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <CheckCircle className="h-3 w-3 ml-1" />}
                          قبول
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{parseFloat(offer.offeredFee).toFixed(2)} جنيه</p>
                    <p className="text-xs text-muted-foreground">{offer.driverName} • {offer.driverTransportType || "توصيل"}</p>
                  </div>
                </div>
                {isCountered && (
                  // Q: عندما يكون العرض في حالة COUNTERED، هل يجب أن يستطيع العميل رفضه؟
                  // A: نعم. الواجهة كانت تخفي جميع الأزرار للعروض في حالة COUNTERED، مما
                  //    يجعل العميل عاجزاً عن التراجع عن عرضه المضاد أو رفض السائق كلياً.
                  //    تُكمل هذه الإصلاح إصلاح الخادم الذي يسمح الآن بـ PATCH /reject
                  //    على العروض في حالتَي PENDING وCOUNTERED على حدٍّ سواء.
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="text-xs">
                        أرسلت عرضاً مضاداً بـ <strong>{parseFloat(offer.counterOfferedFee).toFixed(2)} جنيه</strong> — في انتظار رد السائق
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectMutation.mutate(offer.id)}
                      disabled={isBusy}
                      data-testid={`button-reject-countered-${offer.id}`}
                    >
                      <XCircle className="h-3 w-3 ml-1" />
                      إلغاء العرض المضاد ورفض السائق
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={!!counterDialog?.open}
        onOpenChange={(open) => { if (!open) { setCounterDialog(null); setCounterFeeInput(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-right">تقديم سعر مضاد للسائق</DialogTitle>
            <DialogDescription className="text-right">
              أدخل سعراً أقل من عرض السائق ({counterDialog?.originalFee?.toFixed(2)} جنيه). سيرى السائق اقتراحك ويمكنه قبوله.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="counter-fee-input" className="text-right block">
                السعر المقترح (جنيه)
              </Label>
              <Input
                id="counter-fee-input"
                placeholder={`أقل من ${counterDialog?.originalFee?.toFixed(2)} جنيه`}
                inputMode="decimal"
                value={counterFeeInput}
                onChange={(e) => setCounterFeeInput(e.target.value)}
                data-testid="input-counter-fee"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setCounterDialog(null); setCounterFeeInput(""); }}
              data-testid="button-cancel-counter"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleCounterSubmit}
              disabled={counterMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="button-submit-counter"
            >
              {counterMutation.isPending && <Loader2 className="h-3 w-3 animate-spin ml-2" />}
              إرسال العرض المضاد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function CustomerOrderDetails() {
  const { id } = useParams();
  const { toast } = useToast();
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  const { data: order, isLoading, error } = useQuery<any>({
    queryKey: [`/api/orders/${id}`],
    refetchInterval: 30000,
  });

  const cancelSubOrderMutation = useMutation({
    mutationFn: async (subOrderId: string) => {
      const res = await apiFetch(`/api/suborders/${subOrderId}/cancel`, { method: "PATCH" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إلغاء الطلب الفرعي", description: "سيتم استرداد المبلغ إلى محفظتك تلقائياً." });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      setCancelConfirmId(null);
    },
    onError: (err: any) => {
      toast({ title: "فشل الإلغاء", description: err.message || "حدث خطأ أثناء الإلغاء", variant: "destructive" });
      setCancelConfirmId(null);
    },
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

  const effectiveStatus = getEffectiveStatus(order);
  const currentStepIndex = progressSteps.indexOf(effectiveStatus);
  const progressPercentage = Math.max(20, ((currentStepIndex + 1) / progressSteps.length) * 100);

  const subOrders = order.subOrders || order.sub_orders || [];

  // Only count delivery fees for sub-orders that have an assigned driver
  // (fee is locked/confirmed when driver offer is accepted)
  const confirmedDeliveryFees = subOrders.reduce((sum: number, sub: any) => {
    if (!sub.assignedDriverId) return sum;
    const fee = parseFloat(sub.expectedDeliveryFee || "0");
    return sum + (isNaN(fee) ? 0 : fee);
  }, 0);

  // Whether any active sub-order is still waiting for a driver
  const hasPendingDelivery = subOrders.some(
    (sub: any) => !sub.assignedDriverId && sub.status !== "CANCELLED" && sub.status !== "DELIVERED"
  );

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
              {/* BUG-FIX: Was format(date, "dd/MM/yyyy") from date-fns (Western numerals). */}
              تم تقديم الطلب في {new Date(order.createdAt).toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </p>
          </div>
          <Badge className={`${statusColors[effectiveStatus] || "bg-gray-100"} text-sm px-4 py-1`}>
            {statusLabels[effectiveStatus] || effectiveStatus}
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
            <div className="grid grid-cols-4 text-center text-xs font-medium">
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
            {subOrders.map((sub: any) => (
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
                        {sub.expectedDeliveryFee && parseFloat(sub.expectedDeliveryFee) > 0 && (
                          <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                            رسوم التوصيل: {parseFloat(sub.expectedDeliveryFee).toFixed(2)} جنيه
                          </p>
                        )}
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
                      {sub.items?.map((item: any) => {
                        const price = parseFloat(item.price_at_order || item.priceAtOrder || item.price || "0");
                        const qty = parseInt(item.quantity || "1", 10);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium text-right">{item.product_name || item.productName || item.product?.name || "منتج"}</TableCell>
                            <TableCell className="text-center">{qty}</TableCell>
                            <TableCell className="text-left">{isNaN(price) ? "—" : price.toFixed(2)} جنيه</TableCell>
                            <TableCell className="text-left">{isNaN(price) ? "—" : (qty * price).toFixed(2)} جنيه</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex justify-between items-center">
                    <p className="text-sm font-bold">الإجمالي الفرعي: {parseFloat(sub.subtotal).toFixed(2)} جنيه</p>
                    {/* BUG-FIX: Was only showing cancel button for PENDING sub-orders.
                        The backend cancelSubOrder allows cancellation from both PENDING and
                        ACCEPTED states (only blocking IN_TRANSIT, DELIVERED, CANCELLED).
                        A customer whose sub-order was accepted by the store but has no driver
                        yet assigned (ACCEPTED + no assignedDriverId) was silently trapped —
                        the UI hid the cancel button even though the backend fully supported it.
                        Fix: allow cancel for both PENDING and ACCEPTED statuses. */}
                    {["PENDING", "ACCEPTED"].includes(sub.status) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setCancelConfirmId(sub.id)}
                        data-testid={`button-cancel-suborder-${sub.id}`}
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        إلغاء الطلب
                      </Button>
                    )}
                  </div>
                  {sub.status === "ACCEPTED" && !sub.assignedDriverId && (
                    <DeliveryOffersSection subOrderId={sub.id} orderId={order.id} />
                  )}
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
                  <span>{parseFloat(order.totalPrice).toFixed(2)} جنيه</span>
                </div>
                <div className="flex justify-between text-sm flex-row-reverse">
                  <span className="text-muted-foreground">رسوم التوصيل</span>
                  <span>
                    {hasPendingDelivery && confirmedDeliveryFees === 0 ? (
                      <span className="text-amber-500 font-medium text-xs">في انتظار عرض السائق</span>
                    ) : hasPendingDelivery && confirmedDeliveryFees > 0 ? (
                      <span>
                        {confirmedDeliveryFees.toFixed(2)} جنيه{" "}
                        <span className="text-amber-500 text-xs">+ في انتظار باقي العروض</span>
                      </span>
                    ) : (
                      `${confirmedDeliveryFees.toFixed(2)} جنيه`
                    )}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg flex-row-reverse">
                  <span>الإجمالي</span>
                  <span>
                    {(parseFloat(order.totalPrice) + confirmedDeliveryFees).toFixed(2)} جنيه
                    {hasPendingDelivery && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        (رسوم التوصيل تُضاف عند قبول السائق)
                      </span>
                    )}
                  </span>
                </div>
                <Badge variant="outline" className="w-full justify-center mt-2 py-1">
                  مدفوع عبر المحفظة
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancelConfirmId} onOpenChange={(open) => !open && setCancelConfirmId(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              تأكيد الإلغاء
            </DialogTitle>
            <DialogDescription className="text-right">
              هل أنت متأكد من إلغاء هذا الطلب الفرعي؟ سيتم استرداد المبلغ إلى محفظتك تلقائياً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 flex-row-reverse">
            <Button
              variant="destructive"
              onClick={() => cancelConfirmId && cancelSubOrderMutation.mutate(cancelConfirmId)}
              disabled={cancelSubOrderMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelSubOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              نعم، إلغاء الطلب
            </Button>
            <Button variant="outline" onClick={() => setCancelConfirmId(null)}>
              تراجع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
