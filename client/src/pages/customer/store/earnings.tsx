import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Wallet, ArrowUpCircle, ArrowDownCircle, Info, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { LedgerTransaction } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { StoreLayout } from "@/components/layout/store-layout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type LedgerResponse = {
  transactions: LedgerTransaction[];
  total: number;
  heldFunds: string;
};

export default function StoreEarnings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

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
      
      const res = await fetch(`/api/ledger/transactions?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (!res.ok) throw new Error("Failed to fetch");
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
                ${parseFloat(wallet?.balance || "0").toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-medium">{t('store.earnings.balance_note')}</p>
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
                ${totalCommissions.toFixed(2)}
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
                ${parseFloat(ledgerData?.heldFunds || "0").toFixed(2)}
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
                    <SelectItem value="WITHDRAWAL">{t('customer.wallet.types.DEPOSIT')}</SelectItem>
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
                    const isCredit = tx.type === "DEPOSIT" || tx.type === "COMMISSION" || tx.type === "REFUND";
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
                          {isCredit ? "+" : "-"}${parseFloat(tx.amount).toFixed(2)}
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
    </StoreLayout>
  );
}
