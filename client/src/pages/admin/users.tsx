import { AdminLayout } from "@/components/layout/admin-layout";
import { useUsers, useApproveUser } from "@/hooks/use-users";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { Mail, Phone, Shield, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const approveUser = useApproveUser();
  const { toast } = useToast();

  const handleApprove = async (id: string) => {
    try {
      await approveUser.mutateAsync(id);
      toast({ title: "تمت الموافقة على المستخدم", description: "يمكن للمستخدم الآن تسجيل الدخول." });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">المستخدمون</h1>
          <p className="text-muted-foreground mt-1">إدارة المشرفين وأصحاب المتاجر والعملاء على المنصة.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl premium-shadow border border-border/40 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Spinner /></div>
        ) : !users || users.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">لا يوجد مستخدمون.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-muted-foreground font-semibold uppercase border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">الاسم</th>
                  <th className="px-6 py-4">معلومات الاتصال</th>
                  <th className="px-6 py-4">الدور</th>
                  <th className="px-6 py-4">الحالة</th>
                  <th className="px-6 py-4">تاريخ الانضمام</th>
                  <th className="px-6 py-4 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{user.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{user.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        <span>{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{user.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
                        <Shield className="w-3 h-3" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${
                        user.isApproved ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}>
                        {user.isApproved ? "موافق عليه" : "في الانتظار"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(new Date(user.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!user.isApproved && ["STORE_OWNER", "DRIVER"].includes(user.role) && (
                        <button
                          onClick={() => handleApprove(user.id)}
                          disabled={approveUser.isPending}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          title="الموافقة على المستخدم"
                          data-testid={`button-approve-user-${user.id}`}
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
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
