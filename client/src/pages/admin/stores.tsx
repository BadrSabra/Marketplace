import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useStores, useCreateStore } from "@/hooks/use-stores";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { Plus, Store as StoreIcon, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function StoresPage() {
  const { data: stores, isLoading } = useStores();
  const { user } = useAuth();
  const createStore = useCreateStore();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      toast({ title: "Success", description: "Store created successfully." });
      setIsDialogOpen(false);
      setFormData({ name: "", description: "", locationText: "" });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create store", 
        variant: "destructive" 
      });
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stores</h1>
          <p className="text-muted-foreground mt-1">Manage vendor stores and locations.</p>
        </div>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Store
        </button>
      </div>

      <div className="bg-card rounded-2xl premium-shadow border border-border/40 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Spinner /></div>
        ) : !stores || stores.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <StoreIcon className="w-12 h-12 mb-4 opacity-20" />
            <p>No stores registered yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
            {stores.map((store) => (
              <div key={store.id} className="group border border-border/60 rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all bg-background">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <StoreIcon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                    {store.id.slice(0, 6)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">{store.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {store.description || "No description provided."}
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

      {/* Create Store Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-3xl premium-shadow border border-border p-6 md:p-8 relative animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold mb-6">Register New Store</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Store Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-background border-2 border-border/80 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Location</label>
                <input 
                  type="text" 
                  value={formData.locationText}
                  onChange={e => setFormData({...formData, locationText: e.target.value})}
                  className="w-full px-4 py-3 bg-background border-2 border-border/80 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  placeholder="e.g. 123 Main St, City"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description (Optional)</label>
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
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={createStore.isPending}
                  className="flex-1 px-4 py-3 rounded-xl font-medium bg-primary text-primary-foreground shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {createStore.isPending ? "Creating..." : "Create Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
