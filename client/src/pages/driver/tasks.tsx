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
      toast({ title: "Success", description: "Offer submitted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/available-tasks"] });
      setSelectedTask(null);
      setProposedFee("");
      setNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit offer", variant: "destructive" });
    }
  });

  const acceptMutation = useMutation({
    mutationFn: async (subOrderId: string) => {
      const res = await apiRequest("PATCH", `/api/delivery/suborders/${subOrderId}/accept`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task claimed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/available-tasks"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to claim task", variant: "destructive" });
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
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Available Delivery Tasks</h1>
        <p className="text-muted-foreground">Browse and claim available delivery requests in your area.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open Marketplace</CardTitle>
          <CardDescription>Tasks currently waiting for a driver.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <TableRow key={task.sub_order_id} data-testid={`row-task-${task.sub_order_id}`}>
                    <TableCell className="font-mono text-xs">#{task.order_id.split("-")[0]}</TableCell>
                    <TableCell className="font-medium">{task.customer_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {task.items.map((item, i) => (
                          <span key={i} className="text-xs text-muted-foreground">
                            {item.quantity}x {item.product_name}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {task.customer_address}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        AVAILABLE
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => setSelectedTask(task)}
                        data-testid={`button-offer-${task.sub_order_id}`}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Offer
                      </Button>
                      <Button 
                        size="sm" 
                        className="gap-2"
                        onClick={() => acceptMutation.mutate(task.sub_order_id)}
                        disabled={acceptMutation.isPending}
                        data-testid={`button-claim-${task.sub_order_id}`}
                      >
                        {acceptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        Claim
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                    No tasks currently available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Delivery Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fee">Proposed Delivery Fee ($)</Label>
              <Input
                id="fee"
                type="number"
                placeholder="5.00"
                value={proposedFee}
                onChange={(e) => setProposedFee(e.target.value)}
                data-testid="input-proposed-fee"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="I can deliver this within 15 mins..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>Cancel</Button>
            <Button 
              onClick={() => offerMutation.mutate({ 
                subOrderId: selectedTask!.sub_order_id, 
                proposedFee: parseFloat(proposedFee),
                notes 
              })}
              disabled={!proposedFee || parseFloat(proposedFee) <= 0 || offerMutation.isPending}
              data-testid="button-submit-offer"
            >
              {offerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
