import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Store as StoreIcon } from "lucide-react";

export default function StoreCard({ store }: { store: any }) {
  const truncate = (str: string, n: number) => {
    return str?.length > n ? str.substr(0, n - 1) + "..." : str;
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all border-2 group" data-testid={`card-store-${store.id}`}>
      <div className="h-40 md:h-48 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden">
        {store.logoUrl ? (
          <img 
            src={store.logoUrl} 
            alt={store.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <StoreIcon className="h-12 w-12 md:h-16 md:w-16 text-slate-300" />
        )}
        <Badge 
          className="absolute top-3 right-3 text-[10px] md:text-xs" 
          variant={store.isOpen ? "default" : "secondary"}
          data-testid={`status-store-${store.id}`}
        >
          {store.isOpen ? "مفتوح" : "مغلق"}
        </Badge>
      </div>
      <CardHeader className="p-3 md:p-4 pb-1 md:pb-2">
        <h3 className="font-bold text-lg md:text-xl truncate" data-testid={`text-store-name-${store.id}`}>{store.name}</h3>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0">
        <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 min-h-[32px] md:min-h-[40px]" data-testid={`text-store-desc-${store.id}`}>
          {truncate(store.description || "لا يوجد وصف متاح", 100)}
        </p>
      </CardContent>
      <CardFooter className="p-3 md:p-4 pt-0">
        <Link href={`/store/${store.id}`}>
          <Button className="w-full h-9 md:h-10 text-sm md:text-base" data-testid={`button-view-store-${store.id}`}>عرض المتجر</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
