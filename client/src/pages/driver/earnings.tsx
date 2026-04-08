import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, DollarSign, History, TrendingUp, Filter, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

export default function DriverEarnings() {
  const [page, setPage] = useState(0);
  const [type, setType] = useState<string>("ALL");
  const limit = 10;

  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet"],
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

  if (balanceLoading || transactionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const transactions = transactionsData?.transactions || [];
  const totalTransactions = transactionsData?.total || 0;
  const totalPages = Math.ceil(totalTransactions / limit);

  const commissionTotal = transactions
    ?.filter(tx => tx.type === 'COMMISSION' && tx.status === 'COMPLETED')
    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;

  const isInconsistent = false; // Placeholder for logic checking consistency

  return (
    <div className="container mx-auto p-6 space-y-6 text-right" dir="rtl">
      <div className="flex justify-between items-center flex-row-reverse">
        <h1 className="text-3xl font-bold">{t('driver.earnings.title')}</h1>
        {isInconsistent && (
          <Badge variant="destructive" className="flex gap-1 flex-row-reverse">
            <AlertCircle className="h-3 w-3" />
            {t('driver.earnings.inconsistency_alert')}
          </Badge>
        )}
      </div>

      {parseFloat(balanceData?.balance || "0") < 0 && (
        <Alert variant="destructive" className="text-right">
          <AlertCircle className="h-4 w-4 left-auto right-4" />
          <AlertTitle className="pr-7">{t('driver.earnings.warning_title')}</AlertTitle>
          <AlertDescription className="pr-7">
            {t('driver.earnings.negative_balance_warning')}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid md:grid-cols-2 gap-6 flex-row-reverse">
        <Card data-testid="card-wallet-balance" className="text-right">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-row-reverse">
            <CardTitle className="text-sm font-medium">{t('driver.earnings.available_balance')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-balance">${balanceData?.balance || "0.00"}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-commission-total" className="text-right">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-row-reverse">
            <CardTitle className="text-sm font-medium">{t('driver.earnings.total_commissions')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-commissions">${commissionTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-row-reverse">
          <CardTitle className="flex items-center flex-row-reverse">
            <History className="ml-2 h-5 w-5 ml-0 mr-2" /> {t('driver.earnings.history_title')}
          </CardTitle>
          <div className="flex items-center gap-2 flex-row-reverse">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={type} onValueChange={(val) => { setType(val); setPage(0); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-transaction-type">
                <SelectValue placeholder={t('driver.earnings.filters.all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('driver.earnings.filters.all')}</SelectItem>
                <SelectItem value="DEPOSIT">{t('customer.wallet.types.DEPOSIT')}</SelectItem>
                <SelectItem value="COMMISSION">{t('customer.wallet.types.COMMISSION')}</SelectItem>
                <SelectItem value="REFUND">{t('customer.wallet.types.REFUND')}</SelectItem>
                <SelectItem value="WITHDRAWAL">{t('customer.wallet.types.DEPOSIT')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="flex-row-reverse">
                <TableHead className="text-right">{t('driver.earnings.table.date')}</TableHead>
                <TableHead className="text-right">{t('driver.earnings.table.type')}</TableHead>
                <TableHead className="text-right">{t('driver.earnings.table.order_id')}</TableHead>
                <TableHead className="text-right">{t('driver.earnings.table.amount')}</TableHead>
                <TableHead className="text-right">{t('driver.earnings.table.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground" data-testid="text-empty-state">
                    {t('driver.earnings.no_transactions')}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx: any) => (
                  <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`} className="flex-row-reverse">
                    <TableCell className="text-right">{format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell className="font-medium text-right">{t(`customer.wallet.types.${tx.type}`)}</TableCell>
                    <TableCell className="text-xs font-mono text-right">{tx.referenceId || "-"}</TableCell>
                    <TableCell className={cn(
                      "font-medium text-right",
                      tx.type === 'DEPOSIT' || tx.type === 'COMMISSION' ? 'text-green-600' : 'text-red-600'
                    )}>
                      {tx.type === 'DEPOSIT' || tx.type === 'COMMISSION' ? '+' : '-'}${parseFloat(tx.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={
                        tx.status === 'COMPLETED' ? 'outline' : 
                        tx.status === 'PENDING' ? 'secondary' : 'destructive'
                      } className={cn(
                        tx.status === 'COMPLETED' ? 'bg-green-100 text-green-800 border-green-200' :
                        tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : ''
                      )} data-testid={`badge-status-${tx.id}`}>
                        {tx.status}
                      </Badge>
                    </TableCell>
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
