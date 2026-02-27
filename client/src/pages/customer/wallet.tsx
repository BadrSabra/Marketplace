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
import { Loader2, Plus, Wallet as WalletIcon, History, Filter, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";

const depositSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  receiptUrl: z.string().url("Invalid receipt URL"),
});

type DepositForm = z.infer<typeof depositSchema>;

export default function CustomerWallet() {
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [type, setType] = useState<string>("ALL");
  const limit = 10;

  const form = useForm<DepositForm>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: "",
      receiptUrl: "https://example.com/receipt.jpg",
    },
  });

  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet"],
  });

  const { data: pendingDeposits, isLoading: pendingLoading } = useQuery<any[]>({
    queryKey: ["/api/wallet/pending"],
    queryFn: async () => {
      const res = await fetch("/api/wallet/pending");
      if (!res.ok) throw new Error("Failed to fetch pending deposits");
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
      
      const res = await fetch(`/api/ledger/transactions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    }
  });

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
    <div className="container mx-auto p-6 space-y-6 rtl:text-right" dir="auto">
      <h1 className="text-3xl font-bold">{t('customer.wallet.title')}</h1>
      
      <div className="grid md:grid-cols-3 gap-6">
        <Card data-testid="card-available-balance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 rtl:flex-row-reverse">
            <CardTitle className="text-sm font-medium">{t('customer.wallet.available_balance')}</CardTitle>
            <WalletIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-balance">${balanceData?.balance || "0.00"}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-holds">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 rtl:flex-row-reverse">
            <CardTitle className="text-sm font-medium">{t('customer.wallet.pending_holds')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-holds">${pendingTotal.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="md:row-span-2">
          <CardHeader>
            <CardTitle className="text-lg rtl:text-right">{t('customer.wallet.deposit_funds')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => depositMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="rtl:text-right">
                      <FormLabel>{t('customer.wallet.amount_label')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('customer.wallet.amount_placeholder')} {...field} data-testid="input-deposit-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receiptUrl"
                  render={({ field }) => (
                    <FormItem className="rtl:text-right">
                      <FormLabel>{t('customer.wallet.receipt_url_label')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('customer.wallet.receipt_url_placeholder')} {...field} data-testid="input-receipt-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full gap-2 rtl:flex-row-reverse" 
                  disabled={depositMutation.isPending}
                  data-testid="button-submit-deposit"
                >
                  {depositMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Plus className="h-4 w-4" /> {t('customer.wallet.submit_deposit')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 rtl:flex-row-reverse rtl:text-right">
              <Clock className="h-5 w-5" /> {t('customer.wallet.pending_deposits')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="rtl:flex-row-reverse">
                  <TableHead className="rtl:text-right">{t('customer.wallet.date')}</TableHead>
                  <TableHead className="rtl:text-right">{t('customer.wallet.amount')}</TableHead>
                  <TableHead className="rtl:text-right">{t('customer.wallet.status')}</TableHead>
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
                    <TableRow key={d.transaction.id} className="rtl:flex-row-reverse">
                      <TableCell className="rtl:text-right">{format(new Date(d.transaction.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                      <TableCell className="font-medium rtl:text-right">${parseFloat(d.transaction.amount).toFixed(2)}</TableCell>
                      <TableCell className="rtl:text-right">
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
        <CardHeader className="flex flex-row items-center justify-between rtl:flex-row-reverse">
          <CardTitle className="flex items-center rtl:flex-row-reverse rtl:text-right">
            <History className="ml-2 h-5 w-5 rtl:ml-0 rtl:mr-2" /> {t('customer.wallet.transaction_history')}
          </CardTitle>
          <div className="flex items-center gap-2 rtl:flex-row-reverse">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={type} onValueChange={(val) => { setType(val); setPage(0); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-transaction-type">
                <SelectValue placeholder={t('customer.wallet.all_types')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('customer.wallet.all_types')}</SelectItem>
                <SelectItem value="DEPOSIT">{t('customer.wallet.types.DEPOSIT')}</SelectItem>
                <SelectItem value="PAYMENT">{t('customer.wallet.types.PAYMENT')}</SelectItem>
                <SelectItem value="REFUND">{t('customer.wallet.types.REFUND')}</SelectItem>
                <SelectItem value="COMMISSION">{t('customer.wallet.types.COMMISSION')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="rtl:flex-row-reverse">
                <TableHead className="rtl:text-right">{t('customer.wallet.date')}</TableHead>
                <TableHead className="rtl:text-right">{t('customer.wallet.type')}</TableHead>
                <TableHead className="rtl:text-right">{t('customer.wallet.amount')}</TableHead>
                <TableHead className="rtl:text-right">{t('customer.wallet.status')}</TableHead>
                <TableHead className="rtl:text-right">{t('customer.wallet.order_id')}</TableHead>
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
                  <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`} className="rtl:flex-row-reverse">
                    <TableCell className="rtl:text-right">{format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell className="font-medium rtl:text-right">
                      {t(`customer.wallet.types.${tx.type}`)}
                    </TableCell>
                    <TableCell className={`rtl:text-right ${
                      tx.type === 'DEPOSIT' || tx.type === 'COMMISSION' 
                        ? 'text-green-600 font-medium' 
                        : 'text-red-600 font-medium'
                    }`}>
                      {tx.type === 'DEPOSIT' || tx.type === 'COMMISSION' ? '+' : '-'}${parseFloat(tx.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="rtl:text-right">
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
                    <TableCell className="text-xs font-mono rtl:text-right">{tx.referenceId || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4 rtl:flex-row-reverse rtl:space-x-reverse">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.max(0, prev - 1))}
                disabled={page === 0}
                data-testid="button-prev-page"
                className="gap-2 rtl:flex-row-reverse"
              >
                <ChevronLeft className="h-4 w-4" /> {t('customer.wallet.previous')}
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
                className="gap-2 rtl:flex-row-reverse"
              >
                {t('customer.wallet.next')} <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
