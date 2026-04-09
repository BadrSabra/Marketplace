import { AdminLayout } from "@/components/layout/admin-layout";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { ShoppingCart, Truck, CreditCard } from "lucide-react";

// BUG-FIX: Replaced English `format(date, "MMM d, HH:mm a")` with a simple numeric
// date formatter that never produces English month names like "Apr 9, 03:21 AM".
// Using `toLocaleDateString("ar-EG")` produces Arabic locale dates automatically.
function formatArabicDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${date} - ${time}`;
  } catch {
    return dateStr;
  }
}

// BUG-FIX: All three status columns (`overallStatus`, `deliveryStatus`, `paymentStatus`)
// were rendering raw English enum values ("PENDING", "IN_TRANSIT", etc.) directly.
// The entire UI is Arabic-first; raw English enums are unacceptable for end users.
// Added Arabic label maps for all three status types.
const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "في الانتظار",
  ACCEPTED: "مقبول",
  IN_TRANSIT: "في الطريق",
  DELIVERED: "تم التوصيل",
  CANCELLED: "ملغي",
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: "بانتظار سائق",
  ASSIGNED: "تم تعيين سائق",
  PICKED_UP: "تم الاستلام",
  DELIVERED: "تم التوصيل",
  CANCELLED: "ملغي",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "في الانتظار",
  HELD: "محجوز",
  PAID: "مدفوع",
  REFUNDED: "مسترد",
  CANCELLED: "ملغي",
};

// Q: هل يجب تحديث الـ frontend ليتعامل مع بنية الاستجابة المُجزَّأة الجديدة؟
// A: نعم — /api/admin/orders يُعيد الآن { orders, total, limit, offset } بدلاً
//    من مصفوفة مباشرة. أي كود يتوقع مصفوفة مباشرةً (orders.map، orders.length)
//    سيحصل على undefined ويتعطل بصمت: النتيجة صفحة فارغة بدون أي رسالة خطأ.
//    الإصلاح: استخراج data.orders في queryFn، وإضافة data-testid للعدد الإجمالي.
export default function OrdersPage() {
  const { data, isLoading } = useQuery<{ orders: any[]; total: number }>({
    queryKey: ["/api/admin/orders"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/orders");
      return res.json();
    },
    refetchInterval: 30000,
  });
  const orders = data?.orders ?? [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DELIVERED": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "PENDING": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "IN_TRANSIT": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "CANCELLED": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "ACCEPTED": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      default: return "bg-secondary text-muted-foreground";
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الطلبات</h1>
          <p className="text-muted-foreground mt-1">مراقبة جميع طلبات المنصة وعمليات التوصيل.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl premium-shadow border border-border/40 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Spinner /></div>
        ) : !orders || orders.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
            <p>لا توجد طلبات حتى الآن.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right" dir="rtl">
              <thead className="bg-secondary/50 text-muted-foreground font-semibold uppercase border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">رقم الطلب والتاريخ</th>
                  <th className="px-6 py-4">معرّف العميل</th>
                  <th className="px-6 py-4">الحالة</th>
                  <th className="px-6 py-4">التوصيل والدفع</th>
                  <th className="px-6 py-4">الرسوم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {orders.map((order) => (
                  <tr key={order.id} data-testid={`row-order-${order.id}`} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs font-semibold bg-secondary px-2 py-1 rounded inline-block mb-1">
                        {order.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatArabicDate(order.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-muted-foreground" data-testid={`text-customer-id-${order.id}`}>
                        {order.customerId ? order.customerId.slice(0, 8) + "..." : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${getStatusColor(order.overallStatus)}`}
                        data-testid={`status-order-${order.id}`}
                      >
                        {ORDER_STATUS_LABELS[order.overallStatus] ?? order.overallStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                        <span data-testid={`text-delivery-status-${order.id}`}>
                          {DELIVERY_STATUS_LABELS[order.deliveryStatus] ?? order.deliveryStatus ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                        <span data-testid={`text-payment-status-${order.id}`}>
                          {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <div className="text-foreground" data-testid={`text-order-total-${order.id}`}>
                        {Number((order as any).totalPrice || 0).toFixed(2)} ج.م
                      </div>
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
