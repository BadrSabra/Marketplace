import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Package, MapPin, Phone, Clock, Key, CheckCircle, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface ActiveTask {
  id: string;
  orderId: string;
  status: string;
  subtotal: string;
  customerName: string;
  customerPhone: string;
  items: { productName: string; quantity: number }[];
  otp?: string;
}

export default function ActiveDelivery() {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(1800); // 30 mins default

  const { data: task, isLoading } = useQuery<ActiveTask>({
    queryKey: ["/api/suborders/active"],
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!task) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [task]);

  const otpMutation = useMutation({
    mutationFn: async (subOrderId: string) => {
      const res = await apiRequest("POST", `/api/delivery/otp/generate/${subOrderId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('driver.active_delivery.toasts.otp_success_title'), description: t('driver.active_delivery.toasts.otp_success_desc') });
      queryClient.invalidateQueries({ queryKey: ["/api/suborders/active"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/suborders/${task?.id}/status`, { status: newStatus });
      return res.json();
    },
    onSuccess: (_, status) => {
      toast({ title: t('driver.active_delivery.toasts.status_success_title'), description: t('driver.active_delivery.toasts.status_success_desc', { status: t(`store.orders.statuses.${status}`) }) });
      queryClient.invalidateQueries({ queryKey: ["/api/suborders/active"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    <div className="p-8 max-w-2xl mx-auto space-y-6 rtl:text-right" dir="auto">
      <div className="flex justify-between items-center rtl:flex-row-reverse">
        <h1 className="text-3xl font-bold tracking-tight">{t('driver.active_delivery.title')}</h1>
        <Badge className={cn(
          "px-3 py-1 text-xs font-bold",
          task.status === "ASSIGNED" && "bg-blue-100 text-blue-700",
          task.status === "PICKED_UP" && "bg-purple-100 text-purple-700",
          task.status === "DELIVERED" && "bg-green-100 text-green-700"
        )}>
          {t(`store.orders.statuses.${task.status}`)}
        </Badge>
      </div>

      <Card className="border-2 rtl:text-right">
        <CardHeader className="rtl:text-right">
          <div className="flex justify-between items-start rtl:flex-row-reverse">
            <div className="rtl:text-right">
              <CardTitle className="text-2xl">{t('store.order_details.order_number')} #{task.orderId.split("-")[0]}</CardTitle>
              <CardDescription>{t('driver.active_delivery.estimated_delivery', { time: formatTime(timeLeft) })}</CardDescription>
            </div>
            <div className="text-right rtl:text-left">
              <div className="text-2xl font-bold text-primary">${task.subtotal}</div>
              <div className="text-xs text-muted-foreground">{t('driver.active_delivery.total_value')}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 rtl:flex-row-reverse">
            <div className="space-y-1 rtl:text-right">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 rtl:flex-row-reverse">
                <Clock className="h-3 w-3" /> {t('driver.active_delivery.remaining_time')}
              </div>
              <div className={cn("text-xl font-bold", timeLeft < 300 ? "text-red-500 animate-pulse" : "text-foreground")}>
                {formatTime(timeLeft)}
              </div>
            </div>
            <div className="space-y-1 rtl:text-right">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 rtl:flex-row-reverse">
                <Key className="h-3 w-3" /> {t('driver.active_delivery.delivery_otp')}
              </div>
              <div className="text-xl font-mono font-bold tracking-widest text-primary">
                {task.otp || "••••"}
              </div>
            </div>
          </div>

          <div className="space-y-4 rtl:text-right">
            <div className="flex items-start gap-3 rtl:flex-row-reverse">
              <div className="bg-primary/10 p-2 rounded-full">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="rtl:text-right">
                <div className="font-bold">{task.customerName}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-1 rtl:flex-row-reverse">
                  <Phone className="h-3 w-3" /> {task.customerPhone}
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 rtl:text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('store.order_details.items_title')}</div>
              {task.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm rtl:flex-row-reverse">
                  <span>{item.productName}</span>
                  <span className="font-bold">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 rtl:flex-row-reverse">
            {!task.otp && (
              <Button 
                variant="outline" 
                className="w-full gap-2 rtl:flex-row-reverse"
                onClick={() => otpMutation.mutate(task.id)}
                disabled={otpMutation.isPending}
              >
                <Key className="h-4 w-4" /> {t('driver.active_delivery.actions.generate_otp')}
              </Button>
            )}
            {task.status === "ASSIGNED" && (
              <Button 
                className="w-full gap-2 rtl:flex-row-reverse"
                onClick={() => statusMutation.mutate("PICKED_UP")}
                disabled={statusMutation.isPending}
              >
                <Truck className="h-4 w-4" /> {t('driver.active_delivery.actions.mark_picked_up')}
              </Button>
            )}
            {task.status === "PICKED_UP" && (
              <Button 
                className="w-full gap-2 bg-green-600 hover:bg-green-700 rtl:flex-row-reverse"
                onClick={() => statusMutation.mutate("DELIVERED")}
                disabled={statusMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" /> {t('driver.active_delivery.actions.confirm_delivery')}
              </Button>
            )}
            <Button variant="secondary" className="w-full gap-2 rtl:flex-row-reverse" asChild>
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
