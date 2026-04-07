import { useEffect, useState } from "react";
import { useDriverTasks, useAvailableOffers, usePlaceOffer, useVerifyOtp } from "@/hooks/use-driver";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Store, MapPin, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ActiveDelivery, AvailableTask } from "@/lib/api/driver";

export default function DriverTasksPage() {
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useDriverTasks();
  const { data: offers, isLoading: offersLoading, error: offersError } = useAvailableOffers();

  useEffect(() => {
    console.log("TASKS_PAGE_MOUNTED");
  }, []);

  if (tasksLoading || offersLoading) {
    return <TasksSkeleton />;
  }

  if (tasksError || offersError) {
    return (
      <div className="container mx-auto p-4 space-y-8">
        <Card className="bg-destructive/10 text-destructive p-6 border-destructive text-center">
          <p className="font-bold">حدث خطأ أثناء تحميل المهام أو العروض</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>إعادة المحاولة</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-right">المهام</h1>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">مسندة: {tasks?.filter(t => t.status === 'ACCEPTED').length || 0}</Badge>
            <Badge variant="outline">قيد التوصيل: {tasks?.filter(t => t.status === 'IN_TRANSIT').length || 0}</Badge>
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
        <h2 className="text-xl font-semibold text-right">العروض المتاحة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!offers || offers.length === 0 ? (
            <Card className="col-span-full p-8 text-center text-muted-foreground">
              لا توجد عروض متاحة حالياً
              <Button variant="link" onClick={() => window.location.reload()}>التحديث</Button>
            </Card>
          ) : (
            offers.map(offer => <OfferCard key={offer.sub_order_id} offer={offer} />)
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

function OfferCard({ offer }: { offer: AvailableTask }) {
  const placeBidMutation = usePlaceOffer();
  const { toast } = useToast();

  const handleAccept = () => {
    placeBidMutation.mutate(offer.sub_order_id, {
      onError: (error: Error) => {
        toast({ title: "فشل قبول المهمة", description: error.message, variant: "destructive" });
      }
    });
  };

  return (
    <Card className="flex flex-col h-full" data-testid={`card-offer-${offer.sub_order_id}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{offer.store_name}</CardTitle>
          <span className="font-bold text-primary">{offer.subtotal} ج.م</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
          <span>{offer.customer_address || "عنوان المتجر"}</span>
        </div>
        <div className="flex items-start gap-2">
          <Package className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
          <span>{offer.items.map(i => `${i.product_name} (${i.quantity})`).join(", ")}</span>
        </div>
        {offer.created_at && (
          <div className="text-muted-foreground text-xs">
            {new Date(offer.created_at).toLocaleString("ar-EG")}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={handleAccept}
          disabled={placeBidMutation.isPending}
          data-testid={`button-accept-${offer.sub_order_id}`}
        >
          {placeBidMutation.isPending ? <Loader2 className="animate-spin ml-2" /> : "قبول المهمة"}
        </Button>
      </CardFooter>
    </Card>
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
