import { AdminLayout } from "@/components/layout/admin-layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Eye, Clock } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function AdminDepositsPage() {
  const { toast } = useToast();
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const { data: deposits, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/deposits/pending"],
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/deposits/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تمت الموافقة على الإيداع وإضافة الرصيد للعميل" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposits/pending"] });
    },
    onError: (error: Error) => {
      toast({ title: "فشل الموافقة على الإيداع", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/deposits/${id}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم رفض طلب الإيداع" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposits/pending"] });
    },
    onError: (error: Error) => {
      toast({ title: "فشل رفض الإيداع", description: error.message, variant: "destructive" });
    },
  });

  return (
    <AdminLayout>
      <div className="mb-8" dir="rtl">
        <h1 className="text-3xl font-bold text-foreground">طلبات الإيداع</h1>
        <p className="text-muted-foreground mt-2">مراجعة إيصالات الدفع والموافقة على إيداعات العملاء.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Clock className="h-5 w-5 text-yellow-500" />
          <CardTitle>طلبات الإيداع المعلقة</CardTitle>
          {!isLoading && deposits && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 mr-auto">
              {deposits.length} طلب معلق
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !deposits || deposits.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-400" />
              <p className="text-lg font-medium">لا توجد طلبات معلقة</p>
              <p className="text-sm">جميع طلبات الإيداع تمت معالجتها.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العميل</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الإيصال</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits.map((d: any) => (
                    <TableRow key={d.transaction.id} data-testid={`row-deposit-${d.transaction.id}`}>
                      <TableCell className="font-medium">{d.user?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{d.user?.email || "—"}</TableCell>
                      <TableCell>
                        <span className="font-bold text-green-600 text-lg">
                          {parseFloat(d.transaction.amount).toFixed(2)} ج.م
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(d.transaction.createdAt), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {d.transaction.receiptUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            data-testid={`button-view-receipt-${d.transaction.id}`}
                            onClick={() => setViewingReceipt(d.transaction.receiptUrl)}
                          >
                            <Eye className="h-4 w-4" />
                            عرض الإيصال
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">لا يوجد إيصال</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`button-approve-${d.transaction.id}`}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            onClick={() => approveMutation.mutate(d.transaction.id)}
                          >
                            {approveMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            موافقة
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-2"
                            data-testid={`button-reject-${d.transaction.id}`}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            onClick={() => rejectMutation.mutate(d.transaction.id)}
                          >
                            {rejectMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            رفض
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingReceipt} onOpenChange={() => setViewingReceipt(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>صورة إيصال الدفع</DialogTitle>
          </DialogHeader>
          {viewingReceipt && (
            <div className="flex flex-col items-center gap-4">
              <img
                src={viewingReceipt}
                alt="إيصال الدفع"
                className="w-full max-h-[70vh] object-contain rounded-lg border border-border"
              />
              <Button variant="outline" onClick={() => window.open(viewingReceipt, "_blank")}>
                فتح في نافذة جديدة
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
