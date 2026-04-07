import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Store as StoreIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { useState } from "react";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description?: string | null;
    price: string | number;
    stock?: number;
    category?: string;
    imageUrl?: string | null;
    storeId?: string;
    storeName?: string;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const isInStock = product.stock === undefined || product.stock > 0;
  const priceNum = typeof product.price === "string" ? parseFloat(product.price) : product.price;

  const handleAdd = () => {
    if (!isInStock) return;
    addItem({
      productId: product.id,
      name: product.name,
      price: isNaN(priceNum) ? 0 : priceNum,
      storeId: product.storeId || "",
      storeName: product.storeName,
      imageUrl: product.imageUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Card
      className="overflow-hidden group border hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900 flex flex-col"
      data-testid={`card-product-${product.id}`}
    >
      <div className="relative h-44 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            data-testid={`img-product-${product.id}`}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <ShoppingCart className="h-12 w-12" />
          </div>
        )}
        {!isInStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Badge variant="secondary" className="text-sm font-bold px-3 py-1">
              نفدت الكمية
            </Badge>
          </div>
        )}
        {product.category && (
          <Badge
            className="absolute top-2 right-2 text-[10px] px-2 py-0.5 bg-primary/90 text-white border-none"
            data-testid={`badge-category-${product.id}`}
          >
            {product.category}
          </Badge>
        )}
      </div>

      <CardContent className="p-3 flex flex-col flex-grow text-right">
        <h3
          className="font-bold text-sm md:text-base leading-tight mb-1 line-clamp-2 min-h-[2.5rem]"
          data-testid={`text-product-name-${product.id}`}
        >
          {product.name}
        </h3>

        {product.storeName && (
          <div className="flex items-center gap-1 justify-end mb-2">
            <span
              className="text-xs text-muted-foreground truncate"
              data-testid={`text-product-store-${product.id}`}
            >
              {product.storeName}
            </span>
            <StoreIcon className="h-3 w-3 text-muted-foreground shrink-0" />
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 border-t">
          <Button
            size="sm"
            variant={added ? "outline" : isInStock ? "default" : "outline"}
            disabled={!isInStock}
            className={`h-8 text-xs px-3 transition-all ${added ? "border-green-500 text-green-600" : ""}`}
            onClick={handleAdd}
            data-testid={`button-add-cart-${product.id}`}
          >
            {added ? (
              <>
                <Check className="h-3 w-3 ml-1 text-green-600" />
                تمت الإضافة
              </>
            ) : (
              <>
                <ShoppingCart className="h-3 w-3 ml-1" />
                {isInStock ? "أضف للسلة" : "غير متاح"}
              </>
            )}
          </Button>
          <span
            className="text-base font-extrabold text-primary"
            data-testid={`text-product-price-${product.id}`}
          >
            {isNaN(priceNum) ? product.price : priceNum.toFixed(2)} ج.م
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
