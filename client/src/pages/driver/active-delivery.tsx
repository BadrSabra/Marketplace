import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Package, MapPin, Phone, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
// Q: لماذا حُذف useQuery المحلي واستُبدل بـ useDriverTasks؟
// A: كان هذا الملف يستخدم queryKey: ["/api/suborders/active"] مع queryFn
//    الافتراضية (raw API call → كائن مفرد أو null)، بينما useDriverTasks()
//    يستخدم نفس الـ queryKey مع queryFn مُخصصة تُغلّف النتيجة في مصفوفة
//    ([data]). عند التنقل من صفحة المهام إلى هذه الصفحة، كانت TanStack Query
//    تُعيد البيانات المُخزّنة مؤقتاً (مصفوفة ActiveDelivery[]) لكن الكود هنا
//    يتعامل معها كـ ActiveTask (كائن مفرد) → تحطم task.id و task.orderId وغيرها
//    لأن task كانت مصفوفة وليست كائناً.
//    الإصلاح: استخدام useDriverTasks() حصراً حتى يكون الـ cache دائماً متسقاً.
import { useDriverTasks } from "@/hooks/use-driver";
import type { ActiveDelivery as ActiveTask } from "@/lib/api/driver";

const DELIVERY_WINDOW_SECONDS = 1800;

function calcTimeLeft(updatedAt: string | undefined): number {
  if (!updatedAt) return DELIVERY_WINDOW_SECONDS;
  const elapsed = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000);
  return Math.max(0, DELIVERY_WINDOW_SECONDS - elapsed);
}

export default function ActiveDelivery() {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(DELIVERY_WINDOW_SECONDS);
  const [otpInput, setOtpInput] = useState("");

  // Q: لماذا نأخذ أول عنصر من المصفوفة؟
  // A: الـ API يعيد مهمة توصيل واحدة فقط (LIMIT 1 في الـ query البرمجية).
  //    السائق يمكن أن يكون مسنداً لطلب واحد فقط في وقت واحد.
  const { data: tasks, isLoading, error } = useDriverTasks();
  const task: ActiveTask | null = tasks?.[0] ?? null;

  useEffect(() => {
    if (!task) return;
    setTimeLeft(calcTimeLeft(task.updatedAt));
    const interval = setInterval(() => {
      setTimeLeft(calcTimeLeft(task.updatedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [task?.updatedAt]);

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ subOrderId, otpCode }: { subOrderId: string; otpCode: string }) => {
      const res = await apiRequest("POST", `/api/delivery/otp/verify/${subOrderId}`, { otpCode });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تأكيد التسليم", description: "تم التحقق من الرمز وتأكيد توصيل الطلب بنجاح." });
      setOtpInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/suborders/active"] });
    },
    onError: (err: any) => {
      toast({ title: "رمز غير صحيح", description: err.message || "الرمز الذي أدخلته غير صحيح أو منتهي الصلاحية.", variant: "destructive" });
    },
  });


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <Card className="bg-destructive/10 text-destructive p-6 border-destructive">
          <p className="font-bold">حدث خطأ أثناء تحميل بيانات التوصيل</p>
        </Card>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-8 text-center rtl:text-right" dir="auto">
        <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">{t('driver.active_delivery.no_delivery_title')}</h2>
        <p className="text-muted-foreground">{t('driver.active_delivery.no_delivery_desc')}</p>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 text-right" dir="rtl">
      <div className="flex justify-between items-center flex-row-reverse">
        <h1 className="text-3xl font-bold tracking-tight">{t('driver.active_delivery.title')}</h1>
        <Badge className={cn(
          "px-3 py-1 text-xs font-bold",
          task.status === "ASSIGNED" && "bg-blue-100 text-blue-700",
          task.status === "IN_TRANSIT" && "bg-purple-100 text-purple-700",
          task.status === "PICKED_UP" && "bg-purple-100 text-purple-700",
          task.status === "DELIVERED" && "bg-green-100 text-green-700"
        )}>
          {t(`store.orders.statuses.${task.status}`)}
        </Badge>
      </div>

      <Card className="border-2 text-right">
        <CardHeader className="text-right">
          <div className="flex justify-between items-start flex-row-reverse">
            <div className="text-right">
              <CardTitle className="text-2xl">{t('store.order_details.order_number')} #{task.orderId.split("-")[0]}</CardTitle>
              <CardDescription>{t('driver.active_delivery.estimated_delivery', { time: formatTime(timeLeft) })}</CardDescription>
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold text-primary">{task.subtotal} ج.م</div>
              <div className="text-xs text-muted-foreground">{t('driver.active_delivery.total_value')}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-end">
            <div className="space-y-1 text-right">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 flex-row-reverse">
                <Clock className="h-3 w-3" /> {t('driver.active_delivery.remaining_time')}
              </div>
              <div className={cn("text-xl font-bold", timeLeft < 300 ? "text-red-500 animate-pulse" : "text-foreground")}>
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          <div className="space-y-4 text-right">
            <div className="flex items-start gap-3 flex-row-reverse">
              <div className="bg-primary/10 p-2 rounded-full">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="text-right">
                <div className="font-bold">{task.customerName}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-1 flex-row-reverse">
                  <Phone className="h-3 w-3" /> {task.customerPhone}
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('store.order_details.items_title')}</div>
              {task.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm flex-row-reverse">
                  <span className="text-right">{item.productName}</span>
                  <span className="font-bold">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {task.status === "IN_TRANSIT" && task.hasOtp && (
            <div className="border-2 border-primary/20 rounded-xl p-4 space-y-3 bg-primary/5">
              <div className="text-sm font-bold text-right">تأكيد التسليم</div>
              <p className="text-xs text-muted-foreground text-right">
                اطلب من العميل رمز التأكيد المكون من 6 أرقام وأدخله أدناه لتأكيد التسليم
              </p>
              <div className="flex gap-2 flex-row-reverse">
                <Input
                  data-testid="input-otp-verify"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="_ _ _ _ _ _"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center font-mono text-xl tracking-widest"
                />
                <Button
                  data-testid="button-confirm-delivery"
                  className="gap-2 bg-green-600 hover:bg-green-700 shrink-0"
                  onClick={() => verifyOtpMutation.mutate({ subOrderId: task.id, otpCode: otpInput })}
                  disabled={otpInput.length !== 6 || verifyOtpMutation.isPending}
                >
                  {verifyOtpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  تأكيد
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 flex-row-reverse">
            <Button variant="secondary" className="w-full gap-2 flex-row-reverse" asChild>
              <a href={`tel:${task.customerPhone}`}>
                <Phone className="h-4 w-4" /> {t('driver.active_delivery.actions.call_customer')}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
