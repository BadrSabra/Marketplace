import { useOrders } from "@/hooks/use-orders";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CheckCircle2, Package, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export default function CustomerDashboard() {
  const { useMyOrders } = useOrders();
  const { data: orders, isLoading } = useMyOrders();
  const { toast } = useToast();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState<string>("");

  const handleVerify = async (orderId: string, subOrderId: string) => {
    if (otpValue.length !== 6 || !/^\d+$/.test(otpValue)) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a valid 6-digit numeric code.",
        variant: "destructive",
      });
      return;
    }

    try {
      setVerifyingId(subOrderId);
      await apiRequest("POST", "/api/delivery/otp/verify", {
        orderId,
        subOrderId,
        otpCode: otpValue,
      });

      toast({
        title: "Delivery Verified",
        description: "Thank you! Your delivery has been confirmed.",
      });
      
      setOtpValue("");
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger/transactions"] });
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid OTP code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your orders and verify deliveries.</p>
        </div>
        <Link href="/customer/wallet">
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            My Wallet
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Active Deliveries
          </h2>
          
          {orders?.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                No active orders found.
              </CardContent>
            </Card>
          ) : (
            orders?.map((order: any) => (
              <div key={order.id} className="space-y-4">
                {order.subOrders?.map((subOrder: any) => (
                  <Card key={subOrder.id} data-testid={`card-suborder-${subOrder.id}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-medium">
                          Store: {subOrder.store?.name || "Local Store"}
                        </CardTitle>
                        <CardDescription>
                          Order ID: {subOrder.id.split("-")[0]}...
                        </CardDescription>
                      </div>
                      <Badge variant={subOrder.status === "DELIVERED" ? "default" : "secondary"}>
                        {subOrder.status}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      {subOrder.status === "IN_TRANSIT" && (
                        <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                          <p className="text-sm font-medium mb-3">Verify Delivery</p>
                          <div className="flex gap-3">
                            <Input
                              placeholder="Enter 6-digit OTP"
                              value={verifyingId === subOrder.id ? otpValue : ""}
                              onChange={(e) => {
                                setVerifyingId(subOrder.id);
                                setOtpValue(e.target.value);
                              }}
                              maxLength={6}
                              className="max-w-[180px]"
                              data-testid={`input-otp-${subOrder.id}`}
                            />
                            <Button 
                              onClick={() => handleVerify(order.id, subOrder.id)}
                              disabled={verifyingId === subOrder.id && (verifyingId !== subOrder.id || otpValue.length !== 6)}
                              data-testid={`button-verify-${subOrder.id}`}
                            >
                              {verifyingId === subOrder.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Confirm Receipt
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Ask the driver for the delivery code to confirm you received your items.
                          </p>
                        </div>
                      )}
                      {subOrder.status === "DELIVERED" && (
                        <div className="mt-4 flex items-center gap-2 text-green-600 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          Delivery confirmed
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
