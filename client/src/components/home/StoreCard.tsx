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
    <Card className="overflow-hidden hover:shadow-lg transition-shadow border-2" data-testid={`card-store-${store.id}`}>
      <div className="h-48 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
        {store.logoUrl ? (
          <img 
            src={store.logoUrl} 
            alt={store.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <StoreIcon className="h-16 w-16 text-slate-300" />
        )}
        <Badge 
          className="absolute top-4 right-4" 
          variant={store.isOpen ? "default" : "secondary"}
          data-testid={`status-store-${store.id}`}
        >
          {store.isOpen ? "مفتوح" : "مغلق"}
        </Badge>
      </div>
      <CardHeader className="p-4 pb-2">
        <h3 className="font-bold text-xl truncate" data-testid={`text-store-name-${store.id}`}>{store.name}</h3>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]" data-testid={`text-store-desc-${store.id}`}>
          {truncate(store.description || "لا يوجد وصف متاح", 100)}
        </p>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Link href={`/store/${store.id}`}>
          <Button className="w-full" data-testid={`button-view-store-${store.id}`}>عرض المتجر</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
