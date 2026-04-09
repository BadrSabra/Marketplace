import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useStores, useCreateStore, useDeleteStore } from "@/hooks/use-stores";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { Plus, Store as StoreIcon, MapPin, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function StoresPage() {
  const { data: stores, isLoading } = useStores();
  const { user } = useAuth();
  const createStore = useCreateStore();
  const deleteStore = useDeleteStore();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    locationText: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await createStore.mutateAsync({
        ...formData,
        ownerId: user.id
      });
      toast({ title: "تم إنشاء المتجر بنجاح" });
      setIsDialogOpen(false);
      setFormData({ name: "", description: "", locationText: "" });
    } catch (error: any) {
      toast({ 
        title: "خطأ", 
        description: error.message || "فشل إنشاء المتجر", 
        variant: "destructive" 
      });
    }
  };

  const handleDelete = async () => {
    if (!storeToDelete) return;

    try {
      await deleteStore.mutateAsync(storeToDelete);
      toast({ title: "تم حذف المتجر بنجاح" });
    } catch (error: any) {
      toast({ 
        title: "خطأ", 
        description: error.message || "فشل حذف المتجر", 
        variant: "destructive" 
      });
    } finally {
      setStoreToDelete(null);
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">المتاجر</h1>
          <p className="text-muted-foreground mt-1">إدارة متاجر أصحاب المتاجر والمواقع.</p>
        </div>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-5 h-5" />
          إضافة متجر
        </button>
      </div>

      <div className="bg-card rounded-2xl premium-shadow border border-border/40 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Spinner /></div>
        ) : !stores || stores.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <StoreIcon className="w-12 h-12 mb-4 opacity-20" />
            <p>لا توجد متاجر مسجلة بعد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
            {stores.map((store) => (
              <div key={store.id} className="group border border-border/60 rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all bg-background relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <StoreIcon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStoreToDelete(store.id)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete Store"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                      {store.id.slice(0, 6)}
                    </span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">{store.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {store.description || "لا يوجد وصف."}
                </p>
                <div className="flex items-center gap-2 text-xs font-medium text-foreground/80 bg-secondary/50 p-2 rounded-lg">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate">{store.locationText}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!storeToDelete} onOpenChange={(open) => !open && setStoreToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              لا يمكن التراجع عن هذا الإجراء. سيتم حذف المتجر نهائياً وإزالة جميع بياناته.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Store Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-3xl premium-shadow border border-border p-6 md:p-8 relative animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold mb-6">تسجيل متجر جديد</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">اسم المتجر</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-background border-2 border-border/80 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">الموقع</label>
                <input 
                  type="text" 
                  value={formData.locationText}
                  onChange={e => setFormData({...formData, locationText: e.target.value})}
                  className="w-full px-4 py-3 bg-background border-2 border-border/80 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  placeholder="مثال: 123 شارع التحرير، القاهرة"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">الوصف (اختياري)</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-background border-2 border-border/80 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none h-24"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  disabled={createStore.isPending}
                  className="flex-1 px-4 py-3 rounded-xl font-medium bg-primary text-primary-foreground shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {createStore.isPending ? "جارٍ الإنشاء..." : "إنشاء المتجر"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
