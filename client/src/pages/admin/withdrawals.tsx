import { AdminLayout } from "@/components/layout/admin-layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Clock, ArrowDownLeft } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function AdminWithdrawalsPage() {
  const { toast } = useToast();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: withdrawals, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/withdrawals/pending"],
    queryFn: async () => {
      const token = localStorage.getItem("jwt_token");
      const res = await fetch("/api/admin/withdrawals/pending", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("فشل تحميل طلبات السحب");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("jwt_token");
      const res = await fetch(`/api/admin/withdrawals/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "فشلت الموافقة");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تمت الموافقة على طلب السحب بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/pending"] });
    },
    onError: (error: Error) => {
      toast({ title: "فشلت الموافقة على طلب السحب", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const token = localStorage.getItem("jwt_token");
      const res = await fetch(`/api/admin/withdrawals/${id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "فشل الرفض");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم رفض طلب السحب وإعادة الرصيد للمحفظة" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/pending"] });
      setRejectingId(null);
      setRejectNote("");
    },
    onError: (error: Error) => {
      toast({ title: "فشل رفض الطلب", description: error.message, variant: "destructive" });
    },
  });

  const handleReject = () => {
    if (!rejectingId) return;
    rejectMutation.mutate({ id: rejectingId, note: rejectNote });
  };

  return (
    <AdminLayout>
      <div className="mb-8" dir="rtl">
        <h1 className="text-3xl font-bold text-foreground">طلبات سحب الرصيد</h1>
        <p className="text-muted-foreground mt-2">مراجعة طلبات سحب رصيد السائقين والموافقة عليها أو رفضها.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <ArrowDownLeft className="h-5 w-5 text-orange-500" />
          <CardTitle>طلبات السحب المعلقة</CardTitle>
          {!isLoading && withdrawals && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 mr-auto">
              {withdrawals.length} طلب معلق
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !withdrawals || withdrawals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground" dir="rtl">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-400" />
              <p className="text-lg font-medium">لا توجد طلبات معلقة</p>
              <p className="text-sm">جميع طلبات السحب تمت معالجتها.</p>
            </div>
          ) : (
            <div className="overflow-x-auto" dir="rtl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">السائق</TableHead>
                    <TableHead className="text-right">البريد الإلكتروني</TableHead>
                    <TableHead className="text-right">المبلغ المطلوب</TableHead>
                    <TableHead className="text-right">تاريخ الطلب</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w: any) => (
                    <TableRow key={w.request.id} data-testid={`row-withdrawal-${w.request.id}`}>
                      <TableCell className="font-medium text-right">{w.user?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm text-right">{w.user?.email || "—"}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-orange-600 text-lg">
                          {parseFloat(w.request.amount).toFixed(2)} EGP
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm text-right">
                        {format(new Date(w.request.createdAt), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1">
                          <Clock className="h-3 w-3" />
                          في انتظار المراجعة
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`button-approve-withdrawal-${w.request.id}`}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            onClick={() => approveMutation.mutate(w.request.id)}
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
                            data-testid={`button-reject-withdrawal-${w.request.id}`}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            onClick={() => { setRejectingId(w.request.id); setRejectNote(""); }}
                          >
                            <XCircle className="h-4 w-4" />
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

      <Dialog open={!!rejectingId} onOpenChange={(open) => { if (!open) { setRejectingId(null); setRejectNote(""); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              رفض طلب السحب
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              سيتم رفض الطلب وإعادة المبلغ تلقائياً إلى محفظة السائق.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">سبب الرفض (اختياري)</label>
              <Textarea
                placeholder="أدخل سبب الرفض هنا..."
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                data-testid="textarea-reject-note"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectingId(null); setRejectNote(""); }} data-testid="button-cancel-reject">
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
              className="gap-2"
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
