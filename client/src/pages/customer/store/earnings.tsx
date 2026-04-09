import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp, Wallet, ArrowUpCircle, ArrowDownCircle, Info, Search, ArrowDownToLine } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { LedgerTransaction } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { StoreLayout } from "@/components/layout/store-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api";

type LedgerResponse = {
  transactions: LedgerTransaction[];
  total: number;
  heldFunds: string;
};

export default function StoreEarnings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

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

  const { data: wallet, isLoading: isWalletLoading } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet"],
    refetchInterval: 30000,
  });

  const { data: ledgerData, isLoading: isTransactionsLoading } = useQuery<LedgerResponse>({
    queryKey: ["/api/ledger/transactions", { search: searchTerm, type: typeFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (typeFilter !== "ALL") params.append("type", typeFilter);
      
      const res = await apiFetch(`/api/ledger/transactions?${params.toString()}`);
      if (!res.ok) throw new Error("فشل تحميل المعاملات");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const transactions = ledgerData?.transactions || [];

  if (isWalletLoading || isTransactionsLoading) {
    return (
      <StoreLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  const completedCommissions = transactions?.filter(
    (tx) => tx.type === "COMMISSION" && (tx as any).status === "COMPLETED"
  ) || [];

  const totalCommissions = completedCommissions.reduce(
    (acc, tx) => acc + parseFloat(tx.amount),
    0
  );

  return (
    <StoreLayout>
      <div className="space-y-6 rtl:text-right" dir="auto">
        <div className="rtl:text-right">
          <h1 className="text-3xl font-bold tracking-tight">{t('store.earnings.title')}</h1>
          <p className="text-muted-foreground">{t('store.earnings.subtitle')}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 rtl:flex-row-reverse">
          <Card className="bg-primary/5 border-primary/20 rtl:text-right">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 rtl:flex-row-reverse">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">{t('store.earnings.available_balance')}</CardTitle>
              <div className="bg-primary/10 p-2 rounded-lg">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-primary" data-testid="text-balance">
                {parseFloat(wallet?.balance || "0").toFixed(2)} جنيه
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-medium">{t('store.earnings.balance_note')}</p>
              <Button
                className="mt-3 w-full gap-2"
                size="sm"
                onClick={() => setWithdrawOpen(true)}
                disabled={parseFloat(wallet?.balance || "0") <= 0}
                data-testid="button-withdraw"
              >
                <ArrowDownToLine className="h-4 w-4" />
                طلب سحب رصيد
              </Button>
            </CardContent>
          </Card>
          
          <Card className="bg-green-500/5 border-green-500/20 rtl:text-right">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 rtl:flex-row-reverse">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-green-600">{t('store.earnings.total_commissions')}</CardTitle>
              <div className="bg-green-500/10 p-2 rounded-lg">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-green-600" data-testid="text-total-commissions">
                {totalCommissions.toFixed(2)} جنيه
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-medium">{t('store.earnings.commissions_note')}</p>
            </CardContent>
          </Card>

          <Card className="bg-yellow-500/5 border-yellow-500/20 rtl:text-right">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 rtl:flex-row-reverse">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-yellow-600">{t('store.earnings.held_funds')}</CardTitle>
              <div className="bg-yellow-500/10 p-2 rounded-lg">
                <Info className="h-4 w-4 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-yellow-600" data-testid="text-held-funds">
                {parseFloat(ledgerData?.heldFunds || "0").toFixed(2)} جنيه
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-medium">{t('store.earnings.held_note')}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="rtl:text-right">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rtl:flex-row-reverse">
              <div className="rtl:text-right">
                <CardTitle className="flex items-center gap-2 rtl:flex-row-reverse">
                  <Info className="h-5 w-5 text-muted-foreground" />
                  {t('store.earnings.recent_transactions')}
                </CardTitle>
                <CardDescription>{t('store.earnings.transactions_subtitle')}</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 rtl:flex-row-reverse">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-2.5" />
                  <Input
                    placeholder={t('customer.transactions.order_placeholder')}
                    className="pl-9 rtl:pl-3 rtl:pr-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-search-order"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder={t('customer.wallet.type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t('customer.wallet.all_types')}</SelectItem>
                    <SelectItem value="COMMISSION">{t('customer.wallet.types.COMMISSION')}</SelectItem>
                    <SelectItem value="DEPOSIT">{t('customer.wallet.types.DEPOSIT')}</SelectItem>
                    <SelectItem value="WITHDRAWAL">{t('customer.wallet.types.WITHDRAWAL')}</SelectItem>
                    <SelectItem value="REFUND">{t('customer.wallet.types.REFUND')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="rtl:flex-row-reverse">
                  <TableHead className="rtl:text-right">{t('store.earnings.table.date')}</TableHead>
                  <TableHead className="rtl:text-right">{t('store.earnings.table.type')}</TableHead>
                  <TableHead className="rtl:text-right">{t('store.earnings.table.reference')}</TableHead>
                  <TableHead className="rtl:text-right">{t('store.earnings.table.amount')}</TableHead>
                  <TableHead className="rtl:text-right">{t('store.earnings.table.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions && transactions.length > 0 ? (
                  transactions.map((tx) => {
                    const isCredit = (tx.type as string) === "DEPOSIT" || (tx.type as string) === "COMMISSION" || (tx.type as string) === "REFUND";
                    const status = (tx as any).status || "COMPLETED";
                    return (
                      <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`} className="group rtl:flex-row-reverse">
                        <TableCell className="font-medium text-muted-foreground rtl:text-right">
                          {format(new Date(tx.createdAt), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="rtl:text-right">
                          <div className="flex items-center gap-2 rtl:flex-row-reverse">
                            {isCredit ? (
                              <ArrowUpCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowDownCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-bold text-sm">{t(`customer.wallet.types.${tx.type}`)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs rtl:text-right">
                          {tx.referenceId ? `#${tx.referenceId.split("-")[0]}` : "—"}
                        </TableCell>
                        <TableCell className={cn(
                          "font-black text-base rtl:text-right",
                          isCredit ? "text-green-600" : "text-red-600"
                        )}>
                          {isCredit ? "+" : "-"}{parseFloat(tx.amount).toFixed(2)} جنيه
                        </TableCell>
                        <TableCell className="rtl:text-right">
                          <Badge 
                            variant="outline"
                            className={cn(
                              "font-bold px-3 py-0.5",
                              status === "COMPLETED" ? "border-green-200 bg-green-50 text-green-700" : 
                              status === "PENDING" ? "border-yellow-200 bg-yellow-50 text-yellow-700" : 
                              "border-red-200 bg-red-50 text-red-700"
                            )}
                          >
                            {status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                      {t('store.earnings.no_history')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
              الرصيد المتاح: <span className="font-bold text-primary">{parseFloat(wallet?.balance || "0").toFixed(2)} جنيه</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">المبلغ المراد سحبه (جنيه)</Label>
              <Input
                id="withdraw-amount"
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
                parseFloat(withdrawAmount) > parseFloat(wallet?.balance || "0")
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
