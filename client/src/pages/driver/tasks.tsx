import { useQuery, useMutation } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Package, Clock, Send, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { t } from "@/i18n";

interface Task {
  sub_order_id: string;
  order_id: string;
  customer_name: string;
  customer_address: string;
  items: { product_name: string; quantity: number }[];
  subtotal: number;
  created_at: string;
  status: string;
}

export default function DriverTasks() {
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [proposedFee, setProposedFee] = useState("");
  const [notes, setNotes] = useState("");

  const { data: tasksData, isLoading } = useQuery<{ tasks: Task[] }>({
    queryKey: ["/api/delivery/available-tasks"],
    refetchInterval: 30000,
  });

  const offerMutation = useMutation({
    mutationFn: async (data: { subOrderId: string; proposedFee: number; notes?: string }) => {
      const res = await apiRequest("POST", `/api/delivery/suborders/${data.subOrderId}/offer`, {
        proposedFee: data.proposedFee,
        notes: data.notes
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('driver.tasks.toasts.offer_success_title'), description: t('driver.tasks.toasts.offer_success_desc') });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/available-tasks"] });
      setSelectedTask(null);
      setProposedFee("");
      setNotes("");
    },
    onError: (error: any) => {
      toast({ title: t('driver.tasks.toasts.offer_error_title'), description: error.message || t('driver.tasks.toasts.offer_error_desc'), variant: "destructive" });
    }
  });

  const acceptMutation = useMutation({
    mutationFn: async (subOrderId: string) => {
      const res = await apiRequest("PATCH", `/api/delivery/suborders/${subOrderId}/accept`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('driver.tasks.toasts.claim_success_title'), description: t('driver.tasks.toasts.claim_success_desc') });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/available-tasks"] });
    },
    onError: (error: any) => {
      toast({ title: t('driver.tasks.toasts.claim_error_title'), description: error.message || t('driver.tasks.toasts.claim_error_desc'), variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tasks = tasksData?.tasks || [];

  return (
    <div className="p-8 space-y-6 rtl:text-right" dir="auto">
      <div className="rtl:text-right">
        <h1 className="text-3xl font-bold">{t('driver.tasks.title')}</h1>
        <p className="text-muted-foreground">{t('driver.tasks.subtitle')}</p>
      </div>

      <Card>
        <CardHeader className="rtl:text-right">
          <CardTitle>{t('driver.tasks.marketplace_title')}</CardTitle>
          <CardDescription>{t('driver.tasks.marketplace_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="rtl:flex-row-reverse">
                <TableHead className="rtl:text-right">{t('driver.tasks.table.order_id')}</TableHead>
                <TableHead className="rtl:text-right">{t('driver.tasks.table.customer')}</TableHead>
                <TableHead className="rtl:text-right">{t('driver.tasks.table.items')}</TableHead>
                <TableHead className="rtl:text-right">{t('driver.tasks.table.location')}</TableHead>
                <TableHead className="rtl:text-right">{t('driver.tasks.table.status')}</TableHead>
                <TableHead className="text-right rtl:text-left">{t('driver.tasks.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <TableRow key={task.sub_order_id} data-testid={`row-task-${task.sub_order_id}`} className="rtl:flex-row-reverse">
                    <TableCell className="font-mono text-xs rtl:text-right">#{task.order_id.split("-")[0]}</TableCell>
                    <TableCell className="font-medium rtl:text-right">{task.customer_name}</TableCell>
                    <TableCell className="rtl:text-right">
                      <div className="flex flex-col gap-1">
                        {task.items.map((item, i) => (
                          <span key={i} className="text-xs text-muted-foreground">
                            {item.quantity}x {item.product_name}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="rtl:text-right">
                      <div className="flex items-center gap-1 text-xs rtl:flex-row-reverse">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {task.customer_address}
                      </div>
                    </TableCell>
                    <TableCell className="rtl:text-right">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {t('driver.tasks.statuses.AVAILABLE')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2 rtl:space-x-reverse rtl:text-left">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-2 rtl:flex-row-reverse"
                        onClick={() => setSelectedTask(task)}
                        data-testid={`button-offer-${task.sub_order_id}`}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {t('driver.tasks.actions.offer')}
                      </Button>
                      <Button 
                        size="sm" 
                        className="gap-2 rtl:flex-row-reverse"
                        onClick={() => acceptMutation.mutate(task.sub_order_id)}
                        disabled={acceptMutation.isPending}
                        data-testid={`button-claim-${task.sub_order_id}`}
                      >
                        {acceptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        {t('driver.tasks.actions.claim')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                    {t('driver.tasks.no_tasks')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="rtl:text-right">
          <DialogHeader className="rtl:text-right">
            <DialogTitle>{t('driver.tasks.offer_dialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2 rtl:text-right">
              <Label htmlFor="fee">{t('driver.tasks.offer_dialog.fee_label')}</Label>
              <Input
                id="fee"
                type="number"
                placeholder="5.00"
                value={proposedFee}
                onChange={(e) => setProposedFee(e.target.value)}
                data-testid="input-proposed-fee"
                className="rtl:text-right"
              />
            </div>
            <div className="space-y-2 rtl:text-right">
              <Label htmlFor="notes">{t('driver.tasks.offer_dialog.notes_label')}</Label>
              <Textarea
                id="notes"
                placeholder={t('driver.tasks.offer_dialog.notes_placeholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-notes"
                className="rtl:text-right"
              />
            </div>
          </div>
          <DialogFooter className="rtl:flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setSelectedTask(null)}>{t('driver.tasks.offer_dialog.cancel')}</Button>
            <Button 
              onClick={() => offerMutation.mutate({ 
                subOrderId: selectedTask!.sub_order_id, 
                proposedFee: parseFloat(proposedFee),
                notes 
              })}
              disabled={!proposedFee || parseFloat(proposedFee) <= 0 || offerMutation.isPending}
              data-testid="button-submit-offer"
            >
              {offerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin rtl:mr-0 rtl:ml-2" />}
              {t('driver.tasks.offer_dialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
