import { AdminLayout } from "@/components/layout/admin-layout";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownLeft, RotateCcw, Percent } from "lucide-react";

// Q: هل حقول LedgerEntry تتطابق مع ما يُعيده الـ API فعلاً؟
// A: لا — ledger.service.ts يُعيد الحقول بأسماء مختلفة في SELECT alias:
//    - referenceId       → related_order_id
//    - debitUserId       → debit_user_id
//    - creditUserId      → credit_user_id / user_id
//    استخدام entry.referenceId كان يُعيد undefined دائماً مما يجعل كل
//    خانة "مرجع" في جدول المعاملات تعرض "—" حتى مع وجود مرجع صالح.
//    الإصلاح: تحديث الـ interface ليعكس الأسماء الحقيقية المُعادة من الـ API.
interface LedgerEntry {
  id: string;
  related_order_id: string | null;
  debit_user_id: string | null;
  credit_user_id: string | null;
  user_id: string | null;
  amount: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

interface LedgerResponse {
  transactions: LedgerEntry[];
  total: number;
  limit: number;
  offset: number;
  heldFunds: string;
}

const typeConfig: Record<string, { label: string; icon: React.ComponentType<any>; colorClass: string }> = {
  DEPOSIT:    { label: "إيداع",    icon: ArrowDownLeft, colorClass: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
  WITHDRAWAL: { label: "سحب",     icon: ArrowUpRight,  colorClass: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400" },
  COMMISSION: { label: "عمولة",   icon: Percent,       colorClass: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
  REFUND:     { label: "استرداد", icon: RotateCcw,     colorClass: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400" },
};

export default function FinancePage() {
  const { data, isLoading } = useQuery<LedgerResponse>({
    queryKey: ["/api/ledger/transactions"],
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<{
    totalRevenue: string;
    platformCommissions: string;
    storeEarnings: string;
    driverEarnings: string;
  }>({
    queryKey: ["/api/admin/stats"],
  });

  // BUG-FIX: Was data?.data which is always undefined — the API returns { transactions: [...] }
  // not { data: [...] }. The finance page always showed empty "لا توجد معاملات" even when
  // there were transactions in the ledger.
  const entries = data?.transactions ?? [];

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">لوحة المالية</h1>
          <p className="text-muted-foreground mt-1">نظرة شاملة على الإيرادات والمصروفات والعمولات.</p>
        </div>
      </div>

      {statsLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<DollarSign className="w-5 h-5 text-green-600" />}
            label="إجمالي الإيرادات"
            value={`${statsData?.totalRevenue ?? "0.00"} ج.م`}
            colorClass="bg-green-50 dark:bg-green-900/20"
          />
          <StatCard
            icon={<Percent className="w-5 h-5 text-blue-600" />}
            label="عمولات المنصة"
            value={`${statsData?.platformCommissions ?? "0.00"} ج.م`}
            colorClass="bg-blue-50 dark:bg-blue-900/20"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
            label="أرباح المتاجر"
            value={`${statsData?.storeEarnings ?? "0.00"} ج.م`}
            colorClass="bg-purple-50 dark:bg-purple-900/20"
          />
          <StatCard
            icon={<TrendingDown className="w-5 h-5 text-orange-600" />}
            label="أرباح السائقين"
            value={`${statsData?.driverEarnings ?? "0.00"} ج.م`}
            colorClass="bg-orange-50 dark:bg-orange-900/20"
          />
        </div>
      )}

      <div className="bg-card rounded-2xl premium-shadow border border-border/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/40">
          <h2 className="text-lg font-semibold text-foreground">سجل المعاملات المالية</h2>
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center"><Spinner /></div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">لا توجد معاملات مالية بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-secondary/50 text-muted-foreground font-semibold uppercase border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">النوع</th>
                  <th className="px-6 py-4">المبلغ</th>
                  <th className="px-6 py-4">مرجع</th>
                  <th className="px-6 py-4">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {entries.map((entry) => {
                  const config = typeConfig[entry.type] ?? { label: entry.type, icon: DollarSign, colorClass: "text-muted-foreground bg-muted" };
                  const IconComp = config.icon;
                  return (
                    <tr key={entry.id} className="hover:bg-secondary/20 transition-colors" data-testid={`row-ledger-${entry.id}`}>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${config.colorClass}`}>
                          <IconComp className="w-3.5 h-3.5" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground" data-testid={`text-amount-${entry.id}`}>
                        {Number(entry.amount).toFixed(2)} ج.م
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                        {entry.related_order_id ? entry.related_order_id.slice(0, 8) + "..." : "—"}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {/* BUG-FIX: "dd MMM yyyy" → English month name. Replaced with Arabic locale. */}
                        {new Date(entry.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" })} {new Date(entry.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function StatCard({ icon, label, value, colorClass }: { icon: React.ReactNode; label: string; value: string; colorClass: string }) {
  return (
    <div className={`rounded-2xl p-5 border border-border/40 ${colorClass}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-black/20 flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground" data-testid={`text-stat-${label}`}>{value}</p>
    </div>
  );
}
