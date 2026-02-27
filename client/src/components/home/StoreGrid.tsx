import { useQuery } from "@tanstack/react-query";
import StoreCard from "./StoreCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function StoreGrid() {
  const { data: stores, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/public/stores"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 py-12">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-destructive font-medium" data-testid="text-error-message">حدث خطأ أثناء تحميل المتاجر</p>
        <Button onClick={() => refetch()} data-testid="button-retry">إعادة المحاولة</Button>
      </div>
    );
  }

  if (!stores || stores.length === 0) {
    return (
      <div className="text-center py-20" data-testid="text-empty-stores">
        <p className="text-muted-foreground text-lg">لا توجد متاجر متاحة حالياً</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 py-12">
      {stores.map((store: any) => (
        <StoreCard key={store.id} store={store} />
      ))}
    </div>
  );
}
