import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useParams, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, Package, X, Clock, ArrowLeft, User, MapPin, Phone, Mail, CreditCard, Wallet, ArrowDownToLine, ExternalLink } from "lucide-react";
import { StoreLayout } from "@/components/layout/store-layout";
import { useAuth } from "@/hooks/use-auth";
import { t } from '@/i18n';

export default function StoreOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { data: stores } = useQuery<any[]>({
    queryKey: ["/api/stores"],
  });
  
  const myStore = stores?.find(s => s.ownerId === user?.id);

  const { data: order, isLoading } = useQuery<any>({
    queryKey: [`/api/orders/${id}`],
  });

  const { data: wallet } = useQuery<any>({
    queryKey: ["/api/wallet"],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ subOrderId, status }: { subOrderId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/suborders/${subOrderId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my-store"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products", { storeId: myStore?.id }] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({ 
        title: t('store.orders.toasts.success_title'), 
        description: t('store.orders.toasts.success_desc') 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: t('store.orders.toasts.error_title'), 
        description: error.message || t('store.orders.toasts.error_desc'),
        variant: "destructive"
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (amount: string) =>
      apiRequest("POST", "/api/wallet/withdraw", { amount }),
    onSuccess: () => {
      toast({ title: "تم إرسال طلب السحب", description: "سيتم مراجعة طلبك من قبل الإدارة وسيُنفَّذ خلال 24 ساعة." });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger/transactions"] });
      setWithdrawOpen(false);
      setWithdrawAmount("");
    },
    onError: (err: any) => {
      toast({ title: "فشل طلب السحب", description: err.message || "يرجى التحقق من الرصيد المتاح", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  if (!order) {
    return (
      <StoreLayout>
        <div className="text-center py-24 rtl:text-right" dir="auto">
          <div className="bg-destructive/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold">{t('store.order_details.not_found')}</h2>
          <p className="text-muted-foreground mt-2">{t('store.order_details.not_found_desc')}</p>
          <Link href="/store/dashboard/orders">
            <Button className="mt-6">{t('store.order_details.back_to_orders')}</Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
      ACCEPTED: "bg-blue-100 text-blue-800 border-blue-200",
      READY: "bg-purple-100 text-purple-800 border-purple-200",
      IN_TRANSIT: "bg-cyan-100 text-cyan-800 border-cyan-200",
      PICKED_UP: "bg-cyan-100 text-cyan-800 border-cyan-200",
      DELIVERED: "bg-green-100 text-green-800 border-green-200",
      CANCELLED: "bg-red-100 text-red-800 border-red-200",
    };
    return <Badge variant="outline" className={variants[status] || ""}>{t(`store.orders.statuses.${status}`)}</Badge>;
  };

  const getEffectiveStatus = () => {
    const subs = order.subOrders || order.sub_orders || [];
    if (subs.length === 0) return order.overallStatus || order.overall_status || "PENDING";
    const allDelivered = subs.every((s: any) => s.status === "DELIVERED");
    const allDone = subs.every((s: any) => s.status === "DELIVERED" || s.status === "CANCELLED");
    const allCancelled = subs.every((s: any) => s.status === "CANCELLED");
    if (allDelivered) return "DELIVERED";
    if (allCancelled) return "CANCELLED";
    if (allDone) return "DELIVERED";
    const hasInTransit = subs.some((s: any) => s.status === "IN_TRANSIT");
    if (hasInTransit) return "IN_TRANSIT";
    const hasAccepted = subs.some((s: any) => s.status === "ACCEPTED");
    if (hasAccepted) return "ACCEPTED";
    return order.overallStatus || order.overall_status || "PENDING";
  };

  const effectiveStatus = getEffectiveStatus();
  const walletBalance = parseFloat(wallet?.balance || "0");
  const totalPrice = parseFloat(order.totalPrice || order.total_price || "0");

  return (
    <StoreLayout>
      <div className="space-y-6 rtl:text-right" dir="auto">
        <div className="flex items-center justify-between rtl:flex-row-reverse">
          <div className="flex items-center gap-4 rtl:flex-row-reverse">
            <Link href="/store/dashboard/orders">
              <Button variant="outline" size="icon" className="h-10 w-10">
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </Link>
            <div className="rtl:text-right">
              <h1 className="text-3xl font-bold tracking-tight">{t('store.order_details.title')}</h1>
              <p className="text-muted-foreground flex items-center gap-2 rtl:flex-row-reverse">
                {t('store.order_details.order_number')} <span className="font-mono text-primary font-bold">#{id.split("-")[0]}</span>
                <span className="text-xs">•</span>
                {/* BUG-FIX: "MMM dd, yyyy HH:mm" → English month name. Replaced with Arabic locale. */}
                <span>{new Date(order.createdAt || order.created_at || Date.now()).toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" })}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {getStatusBadge(effectiveStatus)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="rtl:text-right">
                <CardTitle className="flex items-center gap-2 rtl:flex-row-reverse">
                  <Package className="h-5 w-5 text-primary" />
                  {t('store.order_details.items_title')}
                </CardTitle>
                <CardDescription>{t('store.order_details.items_subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(order.subOrders || order.sub_orders)?.map((sub: any) => (
                  <div key={sub.sub_order_id || sub.id} className="border rounded-xl p-5 space-y-5 bg-card shadow-sm rtl:text-right">
                    <div className="flex justify-between items-start rtl:flex-row-reverse">
                      <div className="space-y-1 rtl:text-right">
                        <div className="flex items-center gap-3 rtl:flex-row-reverse">
                          <h3 className="font-bold text-lg">{t('store.order_details.sub_order_number')} #{(sub.sub_order_id || sub.id || "").split("-")[0]}</h3>
                          {getStatusBadge(sub.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{t('store.order_details.store_id')}: {sub.store_id || sub.storeId}</p>
                      </div>
                      <div className="text-left rtl:text-right">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('store.order_details.subtotal')}</p>
                        <p className="text-2xl font-black text-primary">{parseFloat(sub.subtotal || "0").toFixed(2)} جنيه</p>
                      </div>
                    </div>

                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-secondary/50">
                          <TableRow className="rtl:flex-row-reverse">
                            <TableHead className="w-[50%] rtl:text-right">{t('store.order_details.table.product')}</TableHead>
                            <TableHead className="text-center">{t('store.order_details.table.qty')}</TableHead>
                            <TableHead className="text-right rtl:text-right">{t('store.order_details.table.price')}</TableHead>
                            <TableHead className="text-right rtl:text-right">{t('store.order_details.table.total')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(sub.items || []).map((item: any, idx: number) => {
                            const price = parseFloat(item.price_at_order || item.priceAtOrder || item.price || "0");
                            const qty = parseInt(item.quantity || "1", 10);
                            const total = price * qty;
                            return (
                              <TableRow key={idx} className="rtl:flex-row-reverse">
                                <TableCell className="font-medium rtl:text-right">{item.product_name || item.productName || "—"}</TableCell>
                                <TableCell className="text-center">{qty}</TableCell>
                                <TableCell className="text-right rtl:text-right">{price.toFixed(2)} جنيه</TableCell>
                                <TableCell className="text-right rtl:text-right font-bold">{total.toFixed(2)} جنيه</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-end gap-3 pt-2 rtl:flex-row-reverse">
                      {sub.status === "PENDING" && (
                        <>
                          <Button 
                            variant="destructive"
                            className="px-6"
                            onClick={() => statusMutation.mutate({ subOrderId: sub.sub_order_id || sub.id, status: "CANCELLED" })}
                            disabled={statusMutation.isPending}
                          >
                            <X className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" /> {t('store.orders.actions.cancel')}
                          </Button>
                          <Button 
                            className="px-8"
                            onClick={() => statusMutation.mutate({ subOrderId: sub.sub_order_id || sub.id, status: "ACCEPTED" })}
                            disabled={statusMutation.isPending}
                          >
                            <Check className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" /> {t('store.orders.actions.accept')}
                          </Button>
                        </>
                      )}
                      {sub.status === "ACCEPTED" && (
                        <div className="flex items-center gap-3 w-full rtl:flex-row-reverse">
                          <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 font-medium rtl:text-right flex items-center gap-2 rtl:flex-row-reverse">
                            <Clock className="h-4 w-4 shrink-0" />
                            <span>الطلب مقبول - في انتظار السائق لاستلامه</span>
                          </div>
                        </div>
                      )}
                      {sub.status === "IN_TRANSIT" && (
                        <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-2 text-sm text-cyan-700 font-medium rtl:text-right">
                          <Package className="h-4 w-4" />
                          <span>السائق في الطريق للتوصيل</span>
                        </div>
                      )}
                      {sub.status === "DELIVERED" && (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 font-medium rtl:text-right">
                          <Check className="h-4 w-4" />
                          <span>تم التوصيل بنجاح - تمت إضافة العمولة لمحفظتك</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-primary/10 shadow-md">
              <CardHeader className="bg-primary/[0.03] border-b rtl:text-right">
                <CardTitle className="flex items-center gap-2 rtl:flex-row-reverse">
                  <User className="h-5 w-5 text-primary" />
                  {t('store.order_details.customer_info')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-5 rtl:text-right">
                <div className="flex items-start gap-3 rtl:flex-row-reverse">
                  <div className="p-2 rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('store.order_details.name')}</p>
                    <p className="font-semibold text-lg">{order.customerName || order.customer_name || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rtl:flex-row-reverse">
                  <div className="p-2 rounded-full bg-blue-500/10">
                    <Mail className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('store.order_details.email')}</p>
                    <p className="text-sm truncate">{order.customerEmail || order.customer_email || "غير متاح"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rtl:flex-row-reverse">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <Phone className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('store.order_details.phone')}</p>
                    <p className="text-sm">{order.customerPhone || order.customer_phone || "غير متاح"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 pt-2 border-t rtl:flex-row-reverse">
                  <div className="p-2 rounded-full bg-orange-500/10 mt-1">
                    <MapPin className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('store.order_details.address')}</p>
                    <p className="text-sm leading-relaxed">{order.deliveryAddress || order.delivery_address || "لا يوجد عنوان توصيل"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-secondary/20 border-border/50">
              <CardHeader className="rtl:text-right">
                <CardTitle className="flex items-center gap-2 rtl:flex-row-reverse">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  {t('store.order_details.payment_summary')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 rtl:text-right">
                <div className="flex justify-between items-center text-sm rtl:flex-row-reverse">
                  <span className="text-muted-foreground">{t('store.order_details.payment_status')}</span>
                  <Badge variant="outline" className="bg-white">{t(`store.orders.statuses.${order.paymentStatus || order.payment_status}`)}</Badge>
                </div>
                <div className="flex justify-between items-center text-sm rtl:flex-row-reverse">
                  <span className="text-muted-foreground">{t('store.order_details.total_price')}</span>
                  <span className="font-bold text-lg">{isNaN(totalPrice) ? "—" : totalPrice.toFixed(2)} جنيه</span>
                </div>
                <div className="pt-4 border-t space-y-3">
                  <div className="flex justify-between items-center rtl:flex-row-reverse">
                    <div className="flex items-center gap-2 rtl:flex-row-reverse">
                      <Wallet className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">{t('store.order_details.your_balance')}</span>
                    </div>
                    <span className="font-black text-green-600 font-mono">{walletBalance.toFixed(2)} جنيه</span>
                  </div>
                  <Button
                    className="w-full gap-2"
                    size="sm"
                    variant={walletBalance > 0 ? "default" : "outline"}
                    onClick={() => setWithdrawOpen(true)}
                    disabled={walletBalance <= 0}
                    data-testid="button-withdraw"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    {walletBalance > 0 ? `سحب رصيد (${walletBalance.toFixed(2)} جنيه)` : "لا يوجد رصيد للسحب"}
                  </Button>
                  <Link href="/store/earnings">
                    <Button variant="ghost" size="sm" className="w-full gap-2 text-xs text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      عرض كشف الأرباح التفصيلي
                    </Button>
                  </Link>
                </div>
                <p className="text-[10px] text-muted-foreground text-center italic bg-white/50 p-2 rounded">
                  {t('store.order_details.funds_note')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="rtl:text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 rtl:flex-row-reverse">
              <ArrowDownToLine className="h-5 w-5 text-primary" />
              طلب سحب رصيد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              الرصيد المتاح: <span className="font-bold text-primary">{walletBalance.toFixed(2)} جنيه</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount-order">المبلغ المراد سحبه (جنيه)</Label>
              <Input
                id="withdraw-amount-order"
                type="number"
                min="1"
                step="0.01"
                max={wallet?.balance || "0"}
                placeholder="أدخل المبلغ"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                data-testid="input-withdraw-amount"
              />
            </div>
            <p className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              سيتم خصم المبلغ من رصيدك فوراً وإرسال طلب السحب إلى الإدارة للمراجعة والموافقة.
            </p>
          </div>
          <DialogFooter className="rtl:flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => withdrawMutation.mutate(withdrawAmount)}
              disabled={
                withdrawMutation.isPending ||
                !withdrawAmount ||
                parseFloat(withdrawAmount) <= 0 ||
                parseFloat(withdrawAmount) > walletBalance
              }
              data-testid="button-confirm-withdraw"
            >
              {withdrawMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              تأكيد السحب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StoreLayout>
  );
}
