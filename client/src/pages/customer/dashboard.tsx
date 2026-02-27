import { useOrders } from "@/hooks/use-orders";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CheckCircle2, Package, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { t } from "@/i18n";

export default function CustomerDashboard() {
  const { useMyOrders } = useOrders();
  const { data: orders, isLoading } = useMyOrders();
  const { toast } = useToast();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState<string>("");

  const handleVerify = async (orderId: string, subOrderId: string) => {
    if (otpValue.length !== 6 || !/^\d+$/.test(otpValue)) {
      toast({
        title: t('customer.dashboard.invalid_otp_title'),
        description: t('customer.dashboard.invalid_otp_desc'),
        variant: "destructive",
      });
      return;
    }

    try {
      setVerifyingId(subOrderId);
      await apiRequest("POST", "/api/delivery/otp/verify", {
        orderId,
        subOrderId,
        otpCode: otpValue,
      });

      toast({
        title: t('customer.dashboard.success_verify_title'),
        description: t('customer.dashboard.success_verify_desc'),
      });
      
      setOtpValue("");
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger/transactions"] });
    } catch (error: any) {
      toast({
        title: t('customer.dashboard.failed_verify_title'),
        description: error.message || t('customer.dashboard.failed_verify_desc'),
        variant: "destructive",
      });
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto rtl:text-right" dir="auto">
      <header className="mb-8 flex justify-between items-center rtl:flex-row-reverse">
        <div className="rtl:text-right">
          <h1 className="text-3xl font-bold tracking-tight">{t('customer.dashboard.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('customer.dashboard.subtitle')}</p>
        </div>
        <Link href="/customer/wallet">
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            {t('customer.dashboard.my_wallet')}
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 rtl:flex-row-reverse">
            <Package className="h-5 w-5" />
            {t('customer.dashboard.active_deliveries')}
          </h2>
          
          {orders?.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                {t('customer.dashboard.no_orders')}
              </CardContent>
            </Card>
          ) : (
            orders?.map((order: any) => (
              <div key={order.id} className="space-y-4">
                {order.subOrders?.map((subOrder: any) => (
                  <Card key={subOrder.id} data-testid={`card-suborder-${subOrder.id}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 rtl:flex-row-reverse">
                      <div className="space-y-1 rtl:text-right">
                        <CardTitle className="text-base font-medium">
                          {t('customer.dashboard.store')}: {subOrder.store?.name || "Local Store"}
                        </CardTitle>
                        <CardDescription>
                          {t('customer.dashboard.order_id')}: {subOrder.id.split("-")[0]}...
                        </CardDescription>
                      </div>
                      <Badge variant={subOrder.status === "DELIVERED" ? "default" : "secondary"}>
                        {subOrder.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="rtl:text-right">
                      {subOrder.status === "IN_TRANSIT" && (
                        <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                          <p className="text-sm font-medium mb-3">{t('customer.dashboard.verify_delivery')}</p>
                          <div className="flex gap-3 rtl:flex-row-reverse">
                            <Input
                              placeholder={t('customer.dashboard.otp_placeholder')}
                              value={verifyingId === subOrder.id ? otpValue : ""}
                              onChange={(e) => {
                                setVerifyingId(subOrder.id);
                                setOtpValue(e.target.value);
                              }}
                              maxLength={6}
                              className="max-w-[180px]"
                              data-testid={`input-otp-${subOrder.id}`}
                            />
                            <Button 
                              onClick={() => handleVerify(order.id, subOrder.id)}
                              disabled={verifyingId === subOrder.id && (verifyingId !== subOrder.id || otpValue.length !== 6)}
                              data-testid={`button-verify-${subOrder.id}`}
                            >
                              {verifyingId === subOrder.id && <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" />}
                              {t('customer.dashboard.confirm_receipt')}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {t('customer.dashboard.driver_code_help')}
                          </p>
                        </div>
                      )}
                      {subOrder.status === "DELIVERED" && (
                        <div className="mt-4 flex items-center gap-2 text-green-600 text-sm font-medium rtl:flex-row-reverse">
                          <CheckCircle2 className="h-4 w-4" />
                          {t('customer.dashboard.delivery_confirmed')}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
