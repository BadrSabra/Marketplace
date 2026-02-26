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
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-destructive">Failed to load transactions</p>
        <Button onClick={() => refetch()} data-testid="button-retry">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Order ID</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Order ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-order"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="DEPOSIT">Deposit</SelectItem>
                  <SelectItem value="PAYMENT">Payment</SelectItem>
                  <SelectItem value="COMMISSION">Commission</SelectItem>
                  <SelectItem value="REFUND">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mb-6">
            <Button
              variant="outline"
              onClick={resetFilters}
              className="gap-2"
              data-testid="button-reset"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button onClick={() => refetch()} className="gap-2" data-testid="button-apply">
              <Filter className="h-4 w-4" /> Apply Filters
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
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
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.transactions.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-transaction-${t.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(t.createdAt), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">{t.type}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {t.referenceId || "-"}
                      </TableCell>
                      <TableCell className={`font-bold ${getAmountColor(t.type)}`}>
                        {["DEPOSIT", "COMMISSION", "REFUND"].includes(t.type) ? "+" : "-"}
                        EGP {Math.abs(parseFloat(t.amount)).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getStatusColor(t.status)}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {t.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.total > limit && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, data.total)} of {data.total} results
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= data.total}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
