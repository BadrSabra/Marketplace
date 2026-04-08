import { useDriverWallet, useWalletTransactions } from "@/hooks/use-driver";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, ArrowUpRight, ArrowDownLeft, Clock, Loader2, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";

const TX_LABELS: Record<string, string> = {
  COMMISSION: "عمولة توصيل",
  DEPOSIT: "إيداع رصيد",
  WITHDRAWAL: "سحب رصيد",
  REFUND: "استرداد",
};

function isCredit(tx: any): boolean {
  return tx.creditUserId !== null && tx.creditUserId !== undefined;
}

export default function DriverWalletPage() {
  const { toast } = useToast();
  const { data: wallet, isLoading: walletLoading } = useDriverWallet();
  const { data: transactionsData, isLoading: transactionsLoading } = useWalletTransactions();
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const balance = parseFloat(wallet?.balance || "0");

  const withdrawMutation = useMutation({
    mutationFn: async (amount: string) => {
      const res = await apiRequest("POST", "/api/wallet/withdraw", { amount });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "حدث خطأ" }));
        throw new Error(err.message || "فشل السحب");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "تم إرسال طلب السحب", 
        description: `تم إرسال طلب سحب ${withdrawAmount} جنيه وهو قيد مراجعة المشرف. سيتم إشعارك عند الموافقة.` 
      });
      setIsWithdrawOpen(false);
      setWithdrawAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger/transactions"] });
    },
    onError: (err: any) => {
      toast({ title: "فشل السحب", description: err.message, variant: "destructive" });
    },
  });

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "مبلغ غير صالح", description: "يرجى إدخال مبلغ صحيح", variant: "destructive" });
      return;
    }
    if (amount > balance) {
      toast({ title: "رصيد غير كافٍ", description: "المبلغ المطلوب أكبر من رصيدك الحالي", variant: "destructive" });
      return;
    }
    withdrawMutation.mutate(amount.toFixed(2));
  };

  if (walletLoading || transactionsLoading) {
    return <WalletSkeleton />;
  }

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-2xl" dir="rtl">
      <h1 className="text-3xl font-bold">المحفظة</h1>

      <Card className="bg-primary text-primary-foreground overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-foreground/10 rounded-full">
                <Wallet className="w-8 h-8" />
              </div>
              <div>
                <p className="text-primary-foreground/80 text-sm">الرصيد الحالي</p>
                <h2 className="text-4xl font-bold">{wallet?.balance || "0.00"} ج.م</h2>
              </div>
            </div>
            <Button
              variant="secondary"
              className="gap-2 font-bold"
              onClick={() => setIsWithdrawOpen(true)}
              disabled={balance <= 0}
              data-testid="button-open-withdraw"
            >
              <ArrowDownLeft className="w-4 h-4" />
              سحب الرصيد
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="text-xl font-semibold">المعاملات الأخيرة</h3>
        {!transactionsData?.transactions || transactionsData.transactions.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            لا توجد معاملات بعد
          </Card>
        ) : (
          transactionsData.transactions.map((tx: any) => {
            const credit = isCredit(tx);
            const label = TX_LABELS[tx.type] || tx.type;
            return (
              <Card key={tx.id} data-testid={`card-tx-${tx.id}`}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${credit ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                      {credit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{label}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(tx.createdAt).toLocaleString("ar-EG")}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${credit ? "text-green-600" : "text-red-600"}`}>
                    {credit ? "+" : "-"}{parseFloat(tx.amount).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <ArrowRightLeft className="w-5 h-5" />
              طلب سحب الرصيد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
              <p className="text-2xl font-bold text-primary">{wallet?.balance} ج.م</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">المبلغ المراد سحبه</label>
              <Input
                type="number"
                inputMode="decimal"
                min="1"
                max={balance}
                step="0.01"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="text-center text-xl font-mono"
                data-testid="input-withdraw-amount"
              />
              <p className="text-xs text-muted-foreground text-center">
                الحد الأقصى: {wallet?.balance} ج.م
              </p>
              <p className="text-xs text-amber-600 text-center mt-2 bg-amber-50 rounded-lg p-2">
                ⏳ سيتم مراجعة طلبك من المشرف قبل إتمام عملية السحب
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsWithdrawOpen(false); setWithdrawAmount(""); }} data-testid="button-cancel-withdraw">
              إلغاء
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
              className="gap-2"
              data-testid="button-confirm-withdraw"
            >
              {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />}
              إرسال طلب السحب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WalletSkeleton() {
  return (
    <div className="container mx-auto p-4 space-y-6 max-w-2xl" dir="rtl">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    </div>
  );
}
