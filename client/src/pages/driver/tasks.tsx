import { useState } from "react";
import { useDriverTasks, useAvailableOrderTasks, useSubmitOrderOffer, useAcceptOrderCounterOffer, useVerifyOtp } from "@/hooks/use-driver";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Store, MapPin, Package, Tag, CheckCircle2, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActiveDelivery, OrderLevelTask } from "@/lib/api/driver";

export default function DriverTasksPage() {
  // Q: لماذا نستخدم refetch بدلاً من window.location.reload() في تطبيق React؟
  // A: window.location.reload() يُعيد تحميل الصفحة كاملاً ويفقد كامل حالة React
  //    (كل المكونات المُركَّبة، الـ useState، الـ context). هذا يُسبب:
  //    1. وميض الصفحة وتجربة مستخدم سيئة
  //    2. فقدان بيانات نماذج مفتوحة (مثل نموذج تقديم العرض)
  //    3. استهلاك غير ضروري لـ JavaScript bundle
  //    refetch() من TanStack Query تُعيد جلب البيانات فقط دون إعادة تحميل الصفحة.
  const { data: tasks, isLoading: tasksLoading, error: tasksError, refetch: refetchTasks } = useDriverTasks();
  // Q: لماذا نستخدم useAvailableOrderTasks بدلاً من useAvailableOffers هنا؟
  // A: useAvailableOffers تُعيد بطاقة لكل sub-order — فإذا كان الطلب له متجران،
  //    يرى السائق بطاقتين منفصلتين، كل منهما بزر "تقديم عرض سعر" خاص بها.
  //    useAvailableOrderTasks تُعيد بطاقة واحدة لكل طلب رئيسي تضم جميع متاجره.
  const { data: orders, isLoading: ordersLoading, error: ordersError, refetch: refetchOrders } = useAvailableOrderTasks();

  const handleRetry = () => {
    refetchTasks();
    refetchOrders();
  };

  if (tasksLoading || ordersLoading) {
    return <TasksSkeleton />;
  }

  if (tasksError || ordersError) {
    return (
      <div className="container mx-auto p-4 space-y-8">
        <Card className="bg-destructive/10 text-destructive p-6 border-destructive text-center">
          <p className="font-bold">حدث خطأ أثناء تحميل المهام أو العروض</p>
          <Button variant="outline" className="mt-4" onClick={handleRetry}>إعادة المحاولة</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-right">المهام</h1>
          {/* BUG-FIX: Was showing a badge for "ACCEPTED" status tasks, but a driver is only
              assigned to a sub-order when it moves to "IN_TRANSIT" (not ACCEPTED).
              The ACCEPTED badge always showed 0 after the backend fix that corrected
              getActiveDeliveryForDriver to only return IN_TRANSIT tasks.
              Now shows a single accurate "active delivery" count. */}
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">قيد التوصيل: {tasks?.filter(t => t.status === 'IN_TRANSIT').length || 0}</Badge>
            <Badge variant="outline">المتاح: {orders?.length || 0}</Badge>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-right">المهام المسندة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!tasks || tasks.length === 0 ? (
            <Card className="col-span-full p-8 text-center text-muted-foreground">
              لا توجد مهام مسندة حالياً
            </Card>
          ) : (
            tasks.map(task => <TaskCard key={task.id} task={task} />)
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-right">الطلبات المتاحة للتوصيل</h2>
        {/* Q: لماذا تغيّرت الرسالة التوضيحية من "لكل طلب" إلى "لكل طلب كامل"؟
            A: النظام القديم كان يطلب من السائق تقديم عرض لكل طلب فرعي على حدة،
               حتى لو كانت الطلبات الفرعية تنتمي لنفس الطلب الرئيسي.
               النظام الجديد يجمع كل الطلبات الفرعية في بطاقة واحدة، وعرض سعر
               واحد يغطي التوصيل لجميع المتاجر في الطلب. */}
        <p className="text-sm text-muted-foreground text-right">قدّم عرض سعرك لكل طلب وسيختار العميل أفضل عرض</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!orders || orders.length === 0 ? (
            <Card className="col-span-full p-8 text-center text-muted-foreground">
              لا توجد طلبات متاحة حالياً
              <Button variant="ghost" onClick={() => refetchOrders()}>التحديث</Button>
            </Card>
          ) : (
            orders.map(order => <OrderOfferCard key={order.order_id} order={order} />)
          )}
        </div>
      </section>
    </div>
  );
}

function TaskCard({ task }: { task: ActiveDelivery }) {
  const [isOtpOpen, setIsOtpOpen] = useState(false);

  return (
    <Card className="flex flex-col h-full" data-testid={`card-task-${task.id}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{task.storeName || "المتجر"}</CardTitle>
            <Badge variant={task.status === 'IN_TRANSIT' ? 'default' : 'secondary'}>
              {task.status === 'ACCEPTED' ? 'مسندة' : task.status === 'IN_TRANSIT' ? 'قيد التوصيل' : task.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="flex items-start gap-2 text-sm">
          <Package className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
          <span>{task.items.map((i) => i.productName).join(", ") || "لا توجد منتجات"}</span>
        </div>
        <div className="text-sm font-semibold">
          الإجمالي: {task.subtotal} ج.م
        </div>
        {task.customerName && (
          <div className="text-xs text-muted-foreground">
            العميل: {task.customerName}
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {task.status === "IN_TRANSIT" && task.hasOtp && (
          <Button
            className="w-full"
            onClick={() => setIsOtpOpen(true)}
            data-testid={`button-verify-otp-${task.id}`}
          >
            تأكيد التسليم برمز العميل
          </Button>
        )}
      </CardFooter>
      <DeliveryOTPModal
        isOpen={isOtpOpen}
        onClose={() => setIsOtpOpen(false)}
        subOrderId={task.id}
      />
    </Card>
  );
}

// Q: لماذا استُبدل OfferCard بـ OrderOfferCard؟
// A: OfferCard كانت تعمل على مستوى sub-order واحد — زر "تقديم عرض سعر" واحد لكل متجر.
//    عندما يكون للطلب الرئيسي متجران، كانت تظهر بطاقتان منفصلتان.
//    OrderOfferCard تعمل على مستوى الطلب الكامل — بطاقة واحدة تُظهر كل المتاجر
//    وزر "تقديم عرض سعر" واحد يُرسل عرضاً يشمل توصيل الطلب بأكمله.
function OrderOfferCard({ order }: { order: OrderLevelTask }) {
  const submitOrderOfferMutation = useSubmitOrderOffer();
  const acceptOrderCounterMutation = useAcceptOrderCounterOffer();
  const { toast } = useToast();
  const [isOfferOpen, setIsOfferOpen] = useState(false);
  const [feeInput, setFeeInput] = useState("");

  // Q: هل يكفي التحقق من PENDING فقط لمنع السائق من تقديم عرض ثانٍ؟
  // A: لا — في حالة نادرة (تأخر شبكة أو cache قديم) قد يرى السائق طلباً
  //    قَبِل فيه العميل عرضه (status=ACCEPTED) قبل أن تتحدث قائمة العروض.
  //    في هذه الحالة كان يظهر زر "تقديم عرض" بينما العرض قُبل بالفعل،
  //    فإذا ضغط السائق يحصل على خطأ محيّر. الإصلاح: شمل ACCEPTED أيضاً.
  const alreadyOffered = order.driver_offer_status === "PENDING" || order.driver_offer_status === "ACCEPTED";
  const offerRejected = order.driver_offer_status === "REJECTED";
  const offerCountered = order.driver_offer_status === "COUNTERED";

  const handleSubmitOffer = () => {
    const fee = parseFloat(feeInput);
    if (!feeInput || isNaN(fee) || fee <= 0) {
      toast({ title: "يرجى إدخال سعر صحيح", variant: "destructive" });
      return;
    }
    submitOrderOfferMutation.mutate({ orderId: order.order_id, proposedFee: fee }, {
      onSuccess: () => {
        setIsOfferOpen(false);
        setFeeInput("");
        toast({ title: "تم تقديم العرض بنجاح", description: "سيراجع العميل عرضك ويختار الأنسب" });
      },
      onError: (error: Error) => {
        toast({ title: "فشل تقديم العرض", description: error.message, variant: "destructive" });
      }
    });
  };

  const handleAcceptCounter = () => {
    acceptOrderCounterMutation.mutate(order.order_id, {
      onError: (error: Error) => {
        toast({ title: "فشل قبول العرض المضاد", description: error.message, variant: "destructive" });
      }
    });
  };

  const totalSubtotal = order.total_subtotal;

  return (
    <>
      <Card className="flex flex-col h-full" data-testid={`card-order-offer-${order.order_id}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {/* Q: لماذا نعرض جميع المتاجر بدلاً من متجر واحد؟
                  A: الطلب الرئيسي قد يشمل متاجر متعددة — عرض متجر واحد فقط يُخفي
                     هذه المعلومات عن السائق ويمنعه من تقدير مسار التوصيل بدقة. */}
              <CardTitle className="text-base">
                {order.sub_orders.map(s => s.store_name).join(" • ")}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {order.sub_orders.length > 1
                  ? `${order.sub_orders.length} متاجر — توصيل واحد`
                  : "متجر واحد"}
              </p>
            </div>
            <span className="font-bold text-primary text-lg">{totalSubtotal.toFixed(2)} ج.م</span>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
            <span>{order.customer_address || "عنوان العميل"}</span>
          </div>

          {/* Show items per sub-order (store) */}
          {order.sub_orders.map((sub, idx) => (
            <div key={sub.sub_order_id} className="flex items-start gap-2">
              <Package className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
              <span>
                <span className="font-medium">{sub.store_name}:</span>{" "}
                {sub.items.map(i => `${i.product_name} (${i.quantity})`).join(", ")}
              </span>
            </div>
          ))}

          {order.created_at && (
            <div className="text-muted-foreground text-xs">
              {new Date(order.created_at).toLocaleString("ar-EG")}
            </div>
          )}

          {alreadyOffered && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-blue-700 dark:text-blue-300">
              <Clock className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium">
                عرضك: {order.driver_offered_fee} ج.م — في انتظار موافقة العميل
              </span>
            </div>
          )}
          {offerCountered && (
            <div className="flex flex-col gap-1 mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <span className="text-xs font-bold">العميل يقترح سعراً مضاداً:</span>
              <span className="text-sm font-black">{order.driver_counter_offered_fee} ج.م</span>
              <span className="text-xs text-muted-foreground">عرضك الأصلي: {order.driver_offered_fee} ج.م</span>
            </div>
          )}
          {offerRejected && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg text-red-700 dark:text-red-300">
              <span className="text-xs font-medium">تم رفض عرضك السابق ({order.driver_offered_fee} ج.م)</span>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {alreadyOffered ? (
            <Button
              className="w-full"
              variant="outline"
              disabled
              data-testid={`button-offer-pending-${order.order_id}`}
            >
              <CheckCircle2 className="w-4 h-4 ml-2 text-blue-500" />
              تم تقديم العرض — في انتظار العميل
            </Button>
          ) : offerCountered ? (
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleAcceptCounter}
              disabled={acceptOrderCounterMutation.isPending}
              data-testid={`button-accept-counter-${order.order_id}`}
            >
              {acceptOrderCounterMutation.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Tag className="w-4 h-4 ml-2" />}
              قبول اقتراح العميل ({order.driver_counter_offered_fee} ج.م)
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => setIsOfferOpen(true)}
              data-testid={`button-submit-order-offer-${order.order_id}`}
            >
              <Tag className="w-4 h-4 ml-2" />
              {offerRejected ? "تقديم عرض جديد" : "تقديم عرض سعر"}
            </Button>
          )}
        </CardFooter>
      </Card>

      <Dialog open={isOfferOpen} onOpenChange={setIsOfferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-right">تقديم عرض سعر للتوصيل</DialogTitle>
            <DialogDescription className="text-right">
              حدد سعر التوصيل الذي تقترحه للطلب كاملاً. سيراجع العميل جميع العروض ويختار الأنسب.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm text-right space-y-2">
              {/* Q: لماذا نعرض تفاصيل كل المتاجر في نافذة التأكيد؟
                  A: السائق يجب أن يرى ما يلتزم بتوصيله قبل تقديم سعره.
                     إذا كان الطلب يضم متجرين، يعلم السائق أنه سيزور موقعين
                     قبل تسليم الطلب للعميل، فيُسعّر وفقاً لذلك. */}
              {order.sub_orders.map(sub => (
                <div key={sub.sub_order_id} className="border-b last:border-b-0 pb-2 last:pb-0">
                  <p className="font-medium">{sub.store_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {sub.items.map(i => `${i.product_name} (${i.quantity})`).join(", ")}
                    {" — "}{sub.subtotal.toFixed(2)} ج.م
                  </p>
                </div>
              ))}
              <p className="font-bold pt-1">إجمالي قيمة الطلب: {totalSubtotal.toFixed(2)} ج.م</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee-input" className="text-right block">
                رسوم التوصيل المقترحة للطلب كاملاً (جنيه)
              </Label>
              <Input
                id="fee-input"
                placeholder="مثال: 25"
                inputMode="decimal"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                data-testid="input-offer-fee"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOfferOpen(false)} data-testid="button-cancel-offer">
              إلغاء
            </Button>
            <Button
              onClick={handleSubmitOffer}
              disabled={submitOrderOfferMutation.isPending}
              data-testid="button-confirm-offer"
            >
              {submitOrderOfferMutation.isPending && <Loader2 className="animate-spin ml-2" />}
              تقديم العرض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeliveryOTPModal({ isOpen, onClose, subOrderId }: {
  isOpen: boolean;
  onClose: () => void;
  subOrderId: string;
}) {
  const [otpCode, setOtpCode] = useState("");
  const verifyOtpMutation = useVerifyOtp();

  const handleSubmit = () => {
    verifyOtpMutation.mutate({ subOrderId, otpCode }, {
      onSuccess: () => {
        onClose();
        setOtpCode("");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تأكيد التسليم</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground px-1">اطلب من العميل رمز التأكيد المكون من 6 أرقام وأدخله أدناه.</p>
        <div className="py-2">
          <Input
            placeholder="رمز التأكيد (6 أرقام)"
            inputMode="numeric"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            maxLength={6}
            data-testid="input-otp"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-otp">إلغاء</Button>
          <Button onClick={handleSubmit} disabled={verifyOtpMutation.isPending} data-testid="button-submit-otp">
            {verifyOtpMutation.isPending && <Loader2 className="animate-spin ml-2" />}
            تأكيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TasksSkeleton() {
  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-[250px] w-full" />)}
      </div>
    </div>
  );
}
