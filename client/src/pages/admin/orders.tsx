import { AdminLayout } from "@/components/layout/admin-layout";
import { useOrders } from "@/hooks/use-orders";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { ShoppingCart, Truck, CreditCard } from "lucide-react";

export default function OrdersPage() {
  const { data: orders, isLoading } = useOrders();

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'DELIVERED': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'PENDING': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'IN_TRANSIT': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'CANCELLED': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-secondary text-muted-foreground';
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground mt-1">Monitor all platform transactions and deliveries.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl premium-shadow border border-border/40 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Spinner /></div>
        ) : !orders || orders.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
            <p>No orders processed yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-muted-foreground font-semibold uppercase border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">Order ID & Date</th>
                  <th className="px-6 py-4">Customer ID</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Delivery</th>
                  <th className="px-6 py-4">Fees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs font-semibold bg-secondary px-2 py-1 rounded inline-block mb-1">
                        {order.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), "MMM d, HH:mm a")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-muted-foreground">
                        {order.customerId.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${getStatusColor(order.overallStatus)}`}>
                        {order.overallStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                        {order.deliveryStatus}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                        {order.paymentStatus}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <div className="text-foreground">
                        Fee: ${Number(order.proposedDeliveryFee).toFixed(2)}
                      </div>
                      {order.finalDeliveryFee && (
                        <div className="text-xs text-green-600 mt-0.5">
                          Final: ${Number(order.finalDeliveryFee).toFixed(2)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
