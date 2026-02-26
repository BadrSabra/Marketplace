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

type LedgerResponse = {
  transactions: LedgerTransaction[];
  total: number;
  heldFunds: string;
};

export default function StoreEarnings() {
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Hub</h1>
          <p className="text-muted-foreground">Monitor your revenue, wallet balance, and transaction history.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">Available Balance</CardTitle>
              <div className="bg-primary/10 p-2 rounded-lg">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-primary" data-testid="text-balance">
                ${parseFloat(wallet?.balance || "0").toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-medium">Instantly available for your use</p>
            </CardContent>
          </Card>
          
          <Card className="bg-green-500/5 border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-green-600">Total Commissions</CardTitle>
              <div className="bg-green-500/10 p-2 rounded-lg">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-green-600" data-testid="text-total-commissions">
                ${totalCommissions.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-medium">Accumulated lifetime earnings</p>
            </CardContent>
          </Card>

          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-yellow-600">Held Funds</CardTitle>
              <div className="bg-yellow-500/10 p-2 rounded-lg">
                <Info className="h-4 w-4 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-yellow-600" data-testid="text-held-funds">
                ${parseFloat(ledgerData?.heldFunds || "0").toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-medium">Pending approval or processing</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-muted-foreground" />
                  Recent Transactions
                </CardTitle>
                <CardDescription>Detailed record of your store's financial activity.</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Order ID..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-search-order"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="COMMISSION">Commission</SelectItem>
                    <SelectItem value="DEPOSIT">Deposit</SelectItem>
                    <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
                    <SelectItem value="REFUND">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Transaction Type</TableHead>
                  <TableHead>Order Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions && transactions.length > 0 ? (
                  transactions.map((tx) => {
                    const isCredit = tx.type === "DEPOSIT" || tx.type === "COMMISSION" || tx.type === "REFUND";
                    const status = (tx as any).status || "COMPLETED";
                    return (
                      <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`} className="group">
                        <TableCell className="font-medium text-muted-foreground">
                          {format(new Date(tx.createdAt), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isCredit ? (
                              <ArrowUpCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowDownCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-bold text-sm">{tx.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {tx.referenceId ? `#${tx.referenceId.split("-")[0]}` : "—"}
                        </TableCell>
                        <TableCell className={cn(
                          "font-black text-base",
                          isCredit ? "text-green-600" : "text-red-600"
                        )}>
                          {isCredit ? "+" : "-"}${parseFloat(tx.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
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
                      No earning history found.
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

import { cn } from "@/lib/utils";
