import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store as StoreIcon, MapPin, Star, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function StoresPage() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: stores, isLoading } = useQuery<any[]>({
    queryKey: ["/api/public/stores"],
  });

  const filteredStores = stores?.filter((store: any) =>
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans" dir="rtl">
      <Navbar />

      <main className="flex-grow container py-8 px-4">
        {/* Header & Search */}
        <div className="mb-10 text-right">
          <h1 className="text-3xl md:text-4xl font-black text-foreground mb-4">المتاجر في ميت جابر</h1>
          <p className="text-muted-foreground text-lg mb-8">اكتشف أفضل المتاجر والخدمات المحلية من حولك</p>
          
          <div className="relative max-w-2xl">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input 
              placeholder="ابحث عن متجر أو منتج..." 
              className="h-14 pr-12 text-lg rounded-2xl border-2 focus-visible:ring-primary shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Categories (Mock for Talabat feel) */}
        <div className="flex gap-4 overflow-x-auto pb-6 mb-8 no-scrollbar">
          {["الكل", "بقالة", "مطاعم", "صيدليات", "خضروات", "حلويات"].map((cat, i) => (
            <Badge 
              key={i} 
              variant={i === 0 ? "default" : "outline"} 
              className="px-6 py-2 rounded-full text-base font-bold whitespace-nowrap cursor-pointer hover:bg-primary hover:text-white transition-colors"
            >
              {cat}
            </Badge>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredStores?.map((store: any) => (
              <Link key={store.id} href={`/store/${store.id}`}>
                <Card className="group overflow-hidden rounded-3xl border-none shadow-md hover:shadow-xl transition-all cursor-pointer bg-white dark:bg-slate-900">
                  <div className="relative h-48 bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                    {store.logoUrl ? (
                      <img
                        src={store.logoUrl}
                        alt={store.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <StoreIcon className="h-20 w-20 text-slate-400 group-hover:scale-110 transition-transform duration-500" />
                    )}
                    <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm font-bold">4.5</span>
                    </div>
                  </div>
                  <CardContent className="p-6 text-right">
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="text-xl font-black text-foreground group-hover:text-primary transition-colors">
                        {store.name}
                      </h3>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2 min-h-[40px]">
                      {store.description || "أفضل المنتجات المحلية بجودة عالية وأسعار منافسة."}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground border-t pt-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>25-35 دقيقة</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{store.locationText || "ميت جابر"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && filteredStores?.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-slate-100 dark:bg-slate-900 h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="h-10 w-10 text-muted-foreground opacity-20" />
            </div>
            <h2 className="text-2xl font-bold mb-2">لا توجد نتائج</h2>
            <p className="text-muted-foreground">جرب البحث بكلمات أخرى أو تصفح الأقسام</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
