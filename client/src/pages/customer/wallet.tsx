import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Wallet as WalletIcon, History, Filter, ChevronLeft, ChevronRight, Clock, Upload, ImageIcon, X, ArrowDownCircle, MessageCircle, CheckCircle2, Banknote, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { useState, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t } from "@/i18n";

const SUPPORT_WHATSAPP = "https://wa.me/201014938003?text=مرحباً%2C%20أريد%20طلب%20سحب%20رصيد%20من%20محفظتي";

function WalletGuide() {
  return (
    <div className="grid sm:grid-cols-2 gap-4 p-4 bg-gradient-to-l from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-100 dark:border-blue-900">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <Plus className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-green-700 dark:text-green-400">كيف تُودع رصيداً؟</span>
        </div>
        <ol className="space-y-2 text-sm text-muted-foreground pr-2">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">١</span>
            حوّل المبلغ عبر فودافون كاش أو إنستاباي
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">٢</span>
            ارفع صورة الإيصال في النموذج أدناه
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">٣</span>
            انتظر موافقة الإدارة (خلال دقائق إلى ربع ساعة)
          </li>
        </ol>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
            <ArrowDownCircle className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-amber-700 dark:text-amber-400">كيف تسحب رصيدك؟</span>
        </div>
        <ol className="space-y-2 text-sm text-muted-foreground pr-2">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">١</span>
            تواصل مع الدعم الفني للمنصة
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">٢</span>
            أرسل بياناتك وقيمة المبلغ المطلوب
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">٣</span>
            سيتم التحويل خلال خمس دقائق إلى ربع ساعة
          </li>
        </ol>
      </div>
    </div>
  );
}

function WithdrawDialog({ open, onClose, balance }: { open: boolean; onClose: () => void; balance: string }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right text-xl">
            <ArrowDownCircle className="h-6 w-6 text-amber-500" />
            طلب سحب رصيد
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">رصيدك الحالي</p>
            <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{balance} ج.م</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold text-right flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              خطوات السحب
            </p>
            <div className="space-y-2">
              {[
                { icon: MessageCircle, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", text: "تواصل مع الدعم الفني عبر واتساب" },
                { icon: Banknote, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", text: "أخبره بالمبلغ المطلوب وبيانات حسابك" },
                { icon: CheckCircle2, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", text: "سيتم تحويل المبلغ خلال دقائق إلى ربع ساعة" },
              ].map((step, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${step.bg}`}>
                  <step.icon className={`h-5 w-5 shrink-0 ${step.color}`} />
                  <span className="text-sm">{step.text}</span>
                </div>
              ))}
            </div>
          </div>

          <a
            href={SUPPORT_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-base transition-colors"
            data-testid="link-whatsapp-support"
          >
            <MessageCircle className="h-5 w-5" />
            تواصل مع الدعم عبر واتساب
          </a>

          <p className="text-xs text-muted-foreground text-center">
            أوقات الدعم: السبت — الخميس، ٩ص — ١١م
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const depositSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "يجب أن يكون المبلغ رقماً موجباً",
  }),
  receiptUrl: z.string().min(1, "يجب رفع صورة الإيصال"),
});

type DepositForm = z.infer<typeof depositSchema>;

export default function CustomerWallet() {
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [type, setType] = useState<string>("ALL");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const limit = 10;

  const form = useForm<DepositForm>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: "",
      receiptUrl: "",
    },
  });

  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet"],
  });

  const { data: pendingDeposits, isLoading: pendingLoading } = useQuery<any[]>({
    queryKey: ["/api/wallet/pending"],
    queryFn: async () => {
      const res = await apiFetch("/api/wallet/pending");
      return res.json();
    }
  });

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery<{
    transactions: any[];
    total: number;
    heldFunds: string;
  }>({
    queryKey: ["/api/ledger/transactions", { type, page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      if (type !== "ALL") params.append("type", type);
      
      const res = await apiFetch(`/api/ledger/transactions?${params.toString()}`);
      return res.json();
    }
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingReceipt(true);
    const localPreview = URL.createObjectURL(file);
    setReceiptPreview(localPreview);

    try {
      const formData = new FormData();
      formData.append("receipt", file);

      const token = localStorage.getItem("jwt_token");
      const res = await fetch("/api/wallet/deposit/receipt", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "فشل رفع الصورة");
      }

      const { receiptUrl } = await res.json();
      form.setValue("receiptUrl", receiptUrl, { shouldValidate: true });
      toast({ title: "تم رفع الإيصال بنجاح" });
    } catch (err: any) {
      toast({ title: "فشل رفع الإيصال", description: err.message, variant: "destructive" });
      setReceiptPreview(null);
      form.setValue("receiptUrl", "");
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const clearReceipt = () => {
    setReceiptPreview(null);
    form.setValue("receiptUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const depositMutation = useMutation({
    mutationFn: async (data: DepositForm) => {
      const res = await apiRequest("POST", "/api/wallet/deposit", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: t('customer.wallet.success_deposit_title'), 
        description: t('customer.wallet.success_deposit_desc') 
      });
      form.reset();
      setReceiptPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger/transactions"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: t('customer.wallet.failed_deposit_title'), 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  if (balanceLoading || transactionsLoading || pendingLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const transactions = transactionsData?.transactions || [];
  const totalTransactions = transactionsData?.total || 0;
  const totalPages = Math.ceil(totalTransactions / limit);
  const pendingTotal = pendingDeposits?.reduce((sum: number, d: any) => sum + parseFloat(d.transaction.amount), 0) || 0;

  return (
    <div className="container mx-auto p-6 space-y-6 text-right" dir="rtl">
      <div className="flex items-center justify-between">
        <Button
          onClick={() => setWithdrawOpen(true)}
          variant="outline"
          className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-600 dark:hover:bg-amber-950/30 font-bold"
          data-testid="button-request-withdrawal"
        >
          <ArrowDownCircle className="h-4 w-4" />
          طلب سحب رصيد
        </Button>
        <h1 className="text-3xl font-bold">{t('customer.wallet.title')}</h1>
      </div>

      <WalletGuide />

      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        balance={balanceData?.balance || "0.00"}
      />

      <div className="grid md:grid-cols-3 gap-6">
        <Card data-testid="card-available-balance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-row-reverse">
            <CardTitle className="text-sm font-medium">{t('customer.wallet.available_balance')}</CardTitle>
            <WalletIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-balance">{balanceData?.balance || "0.00"} ج.م</div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-holds">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-row-reverse">
            <CardTitle className="text-sm font-medium">{t('customer.wallet.pending_holds')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-holds">{pendingTotal.toFixed(2)} ج.م</div>
          </CardContent>
        </Card>

        <Card className="md:row-span-2">
          <CardHeader>
            <CardTitle className="text-lg text-right">{t('customer.wallet.deposit_funds')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => depositMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel>{t('customer.wallet.amount_label')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('customer.wallet.amount_placeholder')} {...field} data-testid="input-deposit-amount" className="text-right" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="receiptUrl"
                  render={() => (
                    <FormItem className="text-right">
                      <FormLabel>صورة إيصال الدفع</FormLabel>
                      <FormControl>
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            data-testid="input-receipt-file"
                            onChange={handleFileSelect}
                          />
                          {!receiptPreview ? (
                            <button
                              type="button"
                              data-testid="button-upload-receipt"
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
                            >
                              {isUploadingReceipt ? (
                                <Loader2 className="h-8 w-8 animate-spin" />
                              ) : (
                                <Upload className="h-8 w-8" />
                              )}
                              <span className="text-sm font-medium">
                                {isUploadingReceipt ? "جاري الرفع..." : "اضغط لرفع صورة الإيصال"}
                              </span>
                              <span className="text-xs">JPG, PNG, WEBP — حتى 5MB</span>
                            </button>
                          ) : (
                            <div className="relative rounded-lg overflow-hidden border border-border">
                              <img
                                src={receiptPreview}
                                alt="صورة الإيصال"
                                className="w-full max-h-48 object-cover"
                              />
                              <button
                                type="button"
                                onClick={clearReceipt}
                                className="absolute top-2 left-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:opacity-90 transition-opacity"
                                data-testid="button-clear-receipt"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <div className="flex items-center gap-1 px-3 py-2 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-xs">
                                <ImageIcon className="h-3 w-3" />
                                <span>تم رفع الإيصال بنجاح</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full gap-2 flex-row-reverse" 
                  disabled={depositMutation.isPending || isUploadingReceipt}
                  data-testid="button-submit-deposit"
                >
                  {depositMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2 mr-0" />}
                  <Plus className="h-4 w-4" /> {t('customer.wallet.submit_deposit')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 flex-row-reverse text-right">
              <Clock className="h-5 w-5" /> {t('customer.wallet.pending_deposits')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="flex-row-reverse">
                  <TableHead className="text-right">{t('customer.wallet.date')}</TableHead>
                  <TableHead className="text-right">{t('customer.wallet.amount')}</TableHead>
                  <TableHead className="text-right">{t('customer.wallet.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDeposits?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                      {t('customer.wallet.no_pending')}
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingDeposits?.map((d: any) => (
                    <TableRow key={d.transaction.id} className="flex-row-reverse">
                      <TableCell className="text-right">{format(new Date(d.transaction.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                      <TableCell className="font-medium text-right">{parseFloat(d.transaction.amount).toFixed(2)} ج.م</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                          {d.transaction.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-row-reverse">
          <CardTitle className="flex items-center flex-row-reverse text-right">
            <History className="ml-2 h-5 w-5 ml-0 mr-2" /> {t('customer.wallet.transaction_history')}
          </CardTitle>
          <div className="flex items-center gap-2 flex-row-reverse">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={type} onValueChange={(val) => { setType(val); setPage(0); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-transaction-type">
                <SelectValue placeholder={t('customer.wallet.all_types')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('customer.wallet.all_types')}</SelectItem>
                <SelectItem value="DEPOSIT">{t('customer.wallet.types.DEPOSIT')}</SelectItem>
                <SelectItem value="WITHDRAWAL">{t('customer.wallet.types.WITHDRAWAL')}</SelectItem>
                <SelectItem value="COMMISSION">{t('customer.wallet.types.COMMISSION')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="flex-row-reverse">
                <TableHead className="text-right">{t('customer.wallet.date')}</TableHead>
                <TableHead className="text-right">{t('customer.wallet.type')}</TableHead>
                <TableHead className="text-right">{t('customer.wallet.amount')}</TableHead>
                <TableHead className="text-right">{t('customer.wallet.status')}</TableHead>
                <TableHead className="text-right">{t('customer.wallet.order_id')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground" data-testid="text-empty-state">
                    {t('customer.wallet.no_transactions')}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx: any) => (
                  <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`} className="flex-row-reverse">
                    <TableCell className="text-right">{format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell className="font-medium text-right">
                      {t(`customer.wallet.types.${tx.type}`)}
                    </TableCell>
                    <TableCell className={`text-right ${
                      tx.type === 'DEPOSIT' || tx.type === 'COMMISSION' 
                        ? 'text-green-600 font-medium' 
                        : 'text-red-600 font-medium'
                    }`}>
                      {tx.type === 'DEPOSIT' || tx.type === 'COMMISSION' ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} ج.م
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={
                        tx.status === 'COMPLETED' ? 'outline' : 
                        tx.status === 'PENDING' ? 'secondary' : 'destructive'
                      } className={
                        tx.status === 'COMPLETED' ? 'bg-green-100 text-green-800 border-green-200' :
                        tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : ''
                      }>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-right">{tx.related_order_id ? tx.related_order_id.slice(0, 8) : "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4 flex-row-reverse space-x-reverse">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.max(0, prev - 1))}
                disabled={page === 0}
                data-testid="button-prev-page"
                className="gap-2 flex-row-reverse"
              >
                <ChevronLeft className="h-4 w-4 rotate-180" /> {t('customer.wallet.previous')}
              </Button>
              <div className="text-sm font-medium">
                {t('customer.wallet.page_info', { page: page + 1, total: totalPages })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={page >= totalPages - 1}
                data-testid="button-next-page"
                className="gap-2 flex-row-reverse"
              >
                {t('customer.wallet.next')} <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
