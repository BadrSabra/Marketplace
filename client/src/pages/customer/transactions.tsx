import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { Search, Filter, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/i18n";

type Transaction = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "COMMISSION" | "REFUND" | "PAYMENT";
  amount: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  referenceId?: string;
  createdAt: string;
  notes?: string;
};

export default function CustomerTransactions() {
  const { toast } = useToast();
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, isError, refetch } = useQuery<{
    transactions: Transaction[];
    total: number;
  }>({
    queryKey: [
      "/api/ledger/transactions",
      { type, status, search, dateFrom, dateTo, page },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type !== "all") params.append("type", type);
      if (status !== "all") params.append("status", status);
      if (search) params.append("search", search);
      if (dateFrom) params.append("date_from", new Date(dateFrom).toISOString());
      if (dateTo) params.append("date_to", new Date(dateTo).toISOString());
      params.append("limit", limit.toString());
      params.append("offset", ((page - 1) * limit).toString());

      const res = await fetch(`/api/ledger/transactions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "COMPLETED":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "FAILED":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getAmountColor = (type: string) => {
    if (["DEPOSIT", "COMMISSION", "REFUND"].includes(type)) {
      return "text-green-600 dark:text-green-400";
    }
    return "text-red-600 dark:text-red-400";
  };

  const resetFilters = () => {
    setType("all");
    setStatus("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 rtl:text-right" dir="auto">
        <p className="text-destructive">{t('customer.transactions.failed_load')}</p>
        <Button onClick={() => refetch()} data-testid="button-retry">
          {t('customer.transactions.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6 rtl:text-right" dir="auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{t('customer.transactions.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 rtl:flex-row-reverse">
            <div className="space-y-2 rtl:text-right">
              <label className="text-sm font-medium">{t('customer.transactions.search_order')}</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-2" />
                <Input
                  placeholder={t('customer.transactions.order_placeholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 rtl:pl-3 rtl:pr-8"
                  data-testid="input-search-order"
                />
              </div>
            </div>

            <div className="space-y-2 rtl:text-right">
              <label className="text-sm font-medium">{t('customer.wallet.type')}</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-type">
                  <SelectValue placeholder={t('customer.wallet.all_types')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('customer.wallet.all_types')}</SelectItem>
                  <SelectItem value="DEPOSIT">{t('customer.wallet.types.DEPOSIT')}</SelectItem>
                  <SelectItem value="PAYMENT">{t('customer.wallet.types.PAYMENT')}</SelectItem>
                  <SelectItem value="COMMISSION">{t('customer.wallet.types.COMMISSION')}</SelectItem>
                  <SelectItem value="REFUND">{t('customer.wallet.types.REFUND')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rtl:text-right">
              <label className="text-sm font-medium">{t('customer.wallet.status')}</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder={t('customer.transactions.all_status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('customer.transactions.all_status')}</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rtl:text-right">
              <label className="text-sm font-medium">{t('customer.transactions.from_date')}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>

            <div className="space-y-2 rtl:text-right">
              <label className="text-sm font-medium">{t('customer.transactions.to_date')}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mb-6 rtl:flex-row-reverse">
            <Button
              variant="outline"
              onClick={resetFilters}
              className="gap-2 rtl:flex-row-reverse"
              data-testid="button-reset"
            >
              <RotateCcw className="h-4 w-4" /> {t('customer.transactions.reset')}
            </Button>
            <Button onClick={() => refetch()} className="gap-2 rtl:flex-row-reverse" data-testid="button-apply">
              <Filter className="h-4 w-4" /> {t('customer.transactions.apply_filters')}
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="rtl:flex-row-reverse">
                  <TableHead className="rtl:text-right">{t('customer.transactions.date_time')}</TableHead>
                  <TableHead className="rtl:text-right">{t('customer.wallet.type')}</TableHead>
                  <TableHead className="rtl:text-right">{t('customer.wallet.order_id')}</TableHead>
                  <TableHead className="rtl:text-right">{t('customer.wallet.amount')}</TableHead>
                  <TableHead className="rtl:text-right">{t('customer.wallet.status')}</TableHead>
                  <TableHead className="rtl:text-right">{t('customer.transactions.notes')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="h-12 text-center">
                        <Spinner className="inline-block" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {t('customer.wallet.no_transactions')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.transactions.map((t_row) => (
                    <TableRow key={t_row.id} className="hover:bg-muted/50 transition-colors rtl:flex-row-reverse" data-testid={`row-transaction-${t_row.id}`}>
                      <TableCell className="whitespace-nowrap rtl:text-right">
                        {format(new Date(t_row.createdAt), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium rtl:text-right">{t(`customer.wallet.types.${t_row.type}`)}</TableCell>
                      <TableCell className="font-mono text-sm rtl:text-right">
                        {t_row.referenceId || "-"}
                      </TableCell>
                      <TableCell className={`font-bold rtl:text-right ${getAmountColor(t_row.type)}`}>
                        {["DEPOSIT", "COMMISSION", "REFUND"].includes(t_row.type) ? "+" : "-"}
                        EGP {Math.abs(parseFloat(t_row.amount)).toFixed(2)}
                      </TableCell>
                      <TableCell className="rtl:text-right">
                        <Badge variant="secondary" className={getStatusColor(t_row.status)}>
                          {t_row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate rtl:text-right">
                        {t_row.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.total > limit && (
            <div className="flex items-center justify-between space-x-2 py-4 rtl:flex-row-reverse rtl:space-x-reverse">
              <div className="text-sm text-muted-foreground">
                {t('customer.transactions.showing_results', { 
                  start: ((page - 1) * limit) + 1, 
                  end: Math.min(page * limit, data.total), 
                  total: data.total 
                })}
              </div>
              <div className="flex gap-2 rtl:flex-row-reverse">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                  className="rtl:flex-row-reverse"
                >
                  {t('customer.wallet.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= data.total}
                  data-testid="button-next-page"
                  className="rtl:flex-row-reverse"
                >
                  {t('customer.wallet.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
