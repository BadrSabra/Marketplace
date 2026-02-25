import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Wallet } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { WalletTransaction } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function StoreEarnings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: wallet, isLoading: isWalletLoading } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet"],
    refetchInterval: 30000,
  });

  const { data: transactions, isLoading: isTransactionsLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["/api/ledger/transactions"],
    refetchInterval: 30000,
    meta: {
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to fetch transactions history.",
          variant: "destructive",
        });
      },
    },
  });

  if (isWalletLoading || isTransactionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const completedCommissions = transactions?.filter(
    (tx) => tx.type === "COMMISSION" && tx.status === "COMPLETED"
  ) || [];

  const totalCommissions = completedCommissions.reduce(
    (acc, tx) => acc + parseFloat(tx.amount),
    0
  );

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Earnings & Wallet</h1>
        <p className="text-muted-foreground">Manage your store's financial activity and commissions.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-balance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-balance">
              ${parseFloat(wallet?.balance || "0").toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-commissions">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commissions Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-commissions">
              ${totalCommissions.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Related Order</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions && transactions.length > 0 ? (
                transactions.map((tx) => (
                  <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                    <TableCell className="font-medium">
                      {format(new Date(tx.createdAt), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {tx.type.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tx.relatedOrderId || "N/A"}
                    </TableCell>
                    <TableCell className={
                      tx.type === "DEPOSIT" || tx.type === "COMMISSION" || tx.type === "REFUND" || (tx as any).type === "RELEASE"
                        ? "text-green-600 dark:text-green-400 font-medium"
                        : "text-red-600 dark:text-red-400 font-medium"
                    }>
                      {tx.type === "DEPOSIT" || tx.type === "COMMISSION" || tx.type === "REFUND" || (tx as any).type === "RELEASE" ? "+" : "-"}
                      ${parseFloat(tx.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          tx.status === "COMPLETED" ? "default" : 
                          tx.status === "PENDING" ? "secondary" : "destructive"
                        }
                        className={
                          tx.status === "COMPLETED" ? "bg-green-500 hover:bg-green-600" : 
                          tx.status === "PENDING" ? "bg-yellow-500 hover:bg-yellow-600" : ""
                        }
                      >
                        {tx.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No earning history found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
