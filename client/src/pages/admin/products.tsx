import { AdminLayout } from "@/components/layout/admin-layout";
import { useProducts } from "@/hooks/use-products";
import { Spinner } from "@/components/ui/spinner";
import { Package, Tag, Archive } from "lucide-react";

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">المنتجات</h1>
          <p className="text-muted-foreground mt-1">عرض شامل لجميع المنتجات على المنصة.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl premium-shadow border border-border/40 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Spinner /></div>
        ) : !products || products.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <Package className="w-12 h-12 mb-4 opacity-20" />
            <p>لا توجد منتجات متاحة.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead className="bg-secondary/50 text-muted-foreground font-semibold uppercase border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 text-right">تفاصيل المنتج</th>
                  <th className="px-6 py-4 text-right">معرّف المتجر</th>
                  <th className="px-6 py-4 text-right">السعر</th>
                  <th className="px-6 py-4 text-right">المخزون</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{product.name}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{product.description || "-"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                        {product.storeId.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 font-semibold text-foreground">
                        <Tag className="w-3.5 h-3.5 text-primary" />
                        {Number(product.price).toFixed(2)} ج.م
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Archive className="w-4 h-4 text-muted-foreground" />
                        <span className={`font-medium ${product.stock > 10 ? 'text-green-600' : product.stock > 0 ? 'text-yellow-600' : 'text-destructive'}`}>
                          {product.stock} وحدة
                        </span>
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
