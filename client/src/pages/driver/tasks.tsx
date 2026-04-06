import { useEffect } from "react";
import { useDriverTasks, useAvailableOffers, usePlaceOffer, useVerifyOtp, useMarkPickedUp } from "@/hooks/use-driver";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Store, MapPin, Package, Clock } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function DriverTasksPage() {
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useDriverTasks();
  const { data: offers, isLoading: offersLoading, error: offersError } = useAvailableOffers();
  const { toast } = useToast();

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
            <Badge variant="outline">Assigned: {tasks?.filter(t => t.status === 'ASSIGNED').length || 0}</Badge>
            <Badge variant="outline">In Progress: {tasks?.filter(t => t.status === 'ON_THE_WAY').length || 0}</Badge>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-right">المهام المسندة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks?.length === 0 ? (
            <Card className="col-span-full p-8 text-center text-muted-foreground">
              لا توجد مهام مسندة حالياً
            </Card>
          ) : (
            tasks?.map(task => <TaskCard key={task.subOrderId} task={task} />)
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-right">العروض المتاحة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers?.length === 0 ? (
            <Card className="col-span-full p-8 text-center text-muted-foreground">
              لا توجد عروض متاحة حالياً
              <Button variant="link" onClick={() => window.location.reload()}>التحديث</Button>
            </Card>
          ) : (
            offers?.map(offer => <OfferCard key={offer.id} offer={offer} />)
          )}
        </div>
      </section>
    </div>
  );
}

function TaskCard({ task }: { task: any }) {
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const markPickedUpMutation = useMarkPickedUp();

  return (
    <Card className="flex flex-col h-full" data-testid={`card-task-${task.subOrderId}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          {task.store.logoUrl ? (
            <img src={task.store.logoUrl} alt={task.store.name} className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Store className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <CardTitle className="text-lg">{task.store.name}</CardTitle>
            <Badge variant={task.status === 'ON_THE_WAY' ? 'default' : 'secondary'}>
              {task.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
          <span>{task.deliveryAddress}</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <Package className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
          <span>{task.items.map((i: any) => i.name).join(", ")}</span>
        </div>
        {task.assignedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Assigned: {new Date(task.assignedAt).toLocaleTimeString()}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {task.otpId && (task.status === 'READY' || task.status === 'ASSIGNED') && (
          <Button className="w-full" onClick={() => setIsOtpOpen(true)} data-testid={`button-verify-otp-${task.subOrderId}`}>Verify OTP</Button>
        )}
        {task.status === 'ASSIGNED' && (
          <Button
            variant="outline"
            className="w-full"
            data-testid={`button-pickup-${task.subOrderId}`}
            onClick={() => markPickedUpMutation.mutate(task.subOrderId)}
            disabled={markPickedUpMutation.isPending}
          >
            Mark Picked Up
          </Button>
        )}
      </CardFooter>
      <DeliveryOTPModal 
        isOpen={isOtpOpen} 
        onClose={() => setIsOtpOpen(false)} 
        otpId={task.otpId} 
      />
    </Card>
  );
}

function OfferCard({ offer }: { offer: any }) {
  const [bidAmount, setBidAmount] = useState("");
  const placeBidMutation = usePlaceOffer();

  const handlePlaceBid = () => {
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }
    placeBidMutation.mutate({ subOrderId: offer.subOrderId, bidAmount });
  };

  return (
    <Card className="flex flex-col h-full" data-testid={`card-offer-${offer.id}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{offer.store.name}</CardTitle>
          <span className="font-bold text-primary">{offer.subtotal} EGP</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
          <span>Pickup: {offer.pickupAddress || 'Store Location'}</span>
        </div>
        <div className="text-muted-foreground">
          Posted: {new Date(offer.createdAt).toLocaleString()}
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Input 
          type="number" 
          placeholder="Bid Amount" 
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          disabled={placeBidMutation.isPending}
          data-testid={`input-bid-${offer.id}`}
        />
        <Button 
          className="w-full" 
          onClick={handlePlaceBid}
          disabled={placeBidMutation.isPending}
          data-testid={`button-bid-${offer.id}`}
        >
          {placeBidMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : "Place Bid"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function DeliveryOTPModal({ isOpen, onClose, otpId }: { isOpen: boolean, onClose: () => void, otpId: string }) {
  const [otpCode, setOtpCode] = useState("");
  const verifyOtpMutation = useVerifyOtp();

  const handleSubmit = () => {
    verifyOtpMutation.mutate({ otpId, otpCode }, {
      onSuccess: () => {
        onClose();
        console.log("OTP_TEST: correctOtp -> success");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify Delivery OTP</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input 
            placeholder="6-digit OTP" 
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            maxLength={6}
            data-testid="input-otp"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-otp">Cancel</Button>
          <Button onClick={handleSubmit} disabled={verifyOtpMutation.isPending} data-testid="button-submit-otp">
            {verifyOtpMutation.isPending && <Loader2 className="animate-spin mr-2" />}
            Verify
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
