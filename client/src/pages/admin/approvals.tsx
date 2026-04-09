import { AdminLayout } from "@/components/layout/admin-layout";
import { useUsers, useApproveUser } from "@/hooks/use-users";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { UserCheck, Store, Truck, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ApprovalsPage() {
  const { data: users, isLoading } = useUsers();
  const approveUser = useApproveUser();
  const { toast } = useToast();

  const pendingApprovals = (users ?? []).filter(
    (u) => !u.isApproved && ["STORE_OWNER", "DRIVER"].includes(u.role)
  );

  const handleApprove = async (id: string, name: string) => {
    try {
      await approveUser.mutateAsync(id);
      toast({ title: "تمت الموافقة", description: `تمت الموافقة على حساب ${name} بنجاح.` });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const roleConfig: Record<string, { label: string; icon: React.ComponentType<any>; colorClass: string }> = {
    STORE_OWNER: { label: "صاحب متجر", icon: Store,  colorClass: "text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400" },
    DRIVER:      { label: "سائق",      icon: Truck,  colorClass: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">طلبات الموافقة</h1>
          <p className="text-muted-foreground mt-1">مراجعة والموافقة على طلبات تسجيل أصحاب المتاجر والسائقين.</p>
        </div>
        {!isLoading && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
              {pendingApprovals.length} طلب في الانتظار
            </span>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl premium-shadow border border-border/40 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Spinner /></div>
        ) : pendingApprovals.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">لا توجد طلبات معلقة</h3>
            <p className="text-muted-foreground text-sm">تمت مراجعة جميع طلبات التسجيل.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {pendingApprovals.map((user) => {
              const config = roleConfig[user.role];
              const IconComp = config?.icon ?? UserCheck;
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-secondary/20 transition-colors"
                  data-testid={`row-approval-${user.id}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">{user.name}</div>
                      <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                      {user.phone && (
                        <div className="text-xs text-muted-foreground">{user.phone}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="hidden sm:block text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${config?.colorClass ?? ""}`}>
                        <IconComp className="w-3.5 h-3.5" />
                        {config?.label ?? user.role}
                      </span>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(user.createdAt), "dd MMM yyyy")}
                      </div>
                    </div>

                    <button
                      onClick={() => handleApprove(user.id, user.name)}
                      disabled={approveUser.isPending}
                      data-testid={`button-approve-${user.id}`}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserCheck className="w-4 h-4" />
                      موافقة
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
