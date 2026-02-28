import { useDriverWallet, useWalletTransactions } from "@/hooks/use-driver";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function DriverWalletPage() {
  const { data: wallet, isLoading: walletLoading } = useDriverWallet();
  const { data: transactionsData, isLoading: transactionsLoading } = useWalletTransactions();

  if (walletLoading || transactionsLoading) {
    return <WalletSkeleton />;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">المحفظة (Wallet)</h1>
      
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-foreground/10 rounded-full">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <p className="text-primary-foreground/80 text-sm">الرصيد الحالي</p>
              <h2 className="text-4xl font-bold">{wallet?.balance || "0.00"} EGP</h2>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold">المعاملات الأخيرة</h3>
        <div className="space-y-3">
          {transactionsData?.transactions.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              لا توجد معاملات بعد
            </Card>
          ) : (
            transactionsData?.transactions.map((tx: any) => (
              <Card key={tx.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${tx.type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.type === 'CREDIT' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-medium">{tx.type === 'CREDIT' ? 'إيداع' : 'سحب'}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(tx.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function WalletSkeleton() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-32 w-full" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    </div>
  );
}
