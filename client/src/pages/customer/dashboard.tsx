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
      await apiRequest("POST", `/api/delivery/otp/verify/${orderId}`, {
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
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-5xl mx-auto text-right font-sans" dir="rtl">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-right">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
            لوحة تحكم<br />العميل
          </h1>
          <p className="text-muted-foreground mt-3 text-lg max-w-md">
            إدارة طلباتك والتحقق من عمليات التسليم.
          </p>
        </div>
        <Link href="/customer/wallet">
          <Button variant="outline" className="h-auto py-3 px-6 rounded-2xl border-2 hover:bg-secondary transition-all group">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">محفظتي</span>
              <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary/60" />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex items-center gap-3 justify-start">
             <div className="p-2 bg-primary/5 rounded-lg">
               <Package className="h-6 w-6 text-primary" />
             </div>
             <h2 className="text-2xl font-bold text-foreground">
               عمليات التسليم النشطة
             </h2>
          </div>
          
          {orders?.length === 0 ? (
            <Card className="border-dashed border-2 bg-muted/30">
              <CardContent className="p-16 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-4">
                  <Package className="h-12 w-12 opacity-20" />
                  <p className="text-lg font-medium">{t('customer.dashboard.no_orders')}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {orders?.map((order: any) => (
                <div key={order.id} className="space-y-4">
                  {order.subOrders?.map((subOrder: any) => (
                    <Card key={subOrder.id} data-testid={`card-suborder-${subOrder.id}`} className="overflow-hidden border-2 hover:border-primary/20 transition-all shadow-sm">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 bg-secondary/30">
                        <div className="space-y-1 text-right">
                          <CardTitle className="text-xl font-bold">
                            {subOrder.store?.name || "Local Store"}
                          </CardTitle>
                          <CardDescription className="text-sm font-medium opacity-70">
                            {t('customer.dashboard.order_id')}: {subOrder.id.split("-")[0]}
                          </CardDescription>
                        </div>
                        <Badge 
                          variant={subOrder.status === "DELIVERED" ? "default" : "secondary"}
                          className="px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider shadow-sm"
                        >
                          {subOrder.status}
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-6 text-right">
                        {subOrder.status === "IN_TRANSIT" && (
                          <div className="p-6 bg-primary/5 rounded-2xl border-2 border-primary/10 shadow-inner">
                            <p className="text-base font-bold text-primary mb-4 flex items-center gap-2 justify-end">
                              تأكيد الاستلام
                              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-end">
                              <Input
                                placeholder="أدخل رمز التحقق"
                                value={verifyingId === subOrder.id ? otpValue : ""}
                                onChange={(e) => {
                                  setVerifyingId(subOrder.id);
                                  setOtpValue(e.target.value);
                                }}
                                maxLength={6}
                                className="h-12 text-center text-xl font-mono tracking-[0.5em] border-2 focus-visible:ring-primary rounded-xl sm:max-w-[200px]"
                                data-testid={`input-otp-${subOrder.id}`}
                              />
                              <Button 
                                onClick={() => handleVerify(order.id, subOrder.id)}
                                disabled={verifyingId === subOrder.id && (verifyingId !== subOrder.id || otpValue.length !== 6)}
                                className="h-12 px-8 rounded-xl font-bold text-base shadow-md hover:shadow-lg transition-all"
                                data-testid={`button-verify-${subOrder.id}`}
                              >
                                {verifyingId === subOrder.id && <Loader2 className="mr-2 h-4 w-4 animate-spin ml-2 mr-0" />}
                                تأكيد الرمز
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground mt-4 font-medium italic opacity-80">
                              {t('customer.dashboard.driver_code_help')}
                            </p>
                          </div>
                        )}
                        {subOrder.status === "DELIVERED" && (
                          <div className="flex items-center gap-3 text-green-600 bg-green-50 dark:bg-green-950/20 p-4 rounded-xl border border-green-100 dark:border-green-900 justify-end">
                            <span className="text-base font-bold">تم تأكيد التسليم بنجاح</span>
                            <div className="p-1.5 bg-green-100 dark:bg-green-900 rounded-full">
                              <CheckCircle2 className="h-5 w-5" />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

