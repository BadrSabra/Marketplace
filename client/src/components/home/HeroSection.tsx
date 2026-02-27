import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function HeroSection() {
  return (
    <section className="relative py-20 overflow-hidden bg-slate-50 dark:bg-slate-900">
      <div className="container relative z-10 text-center">
        <Badge variant="secondary" className="mb-4 px-4 py-1 rounded-full text-sm font-medium" data-testid="badge-local-service">
          <MapPin className="mr-1 h-3 w-3" />
          خدمة محلية داخل ميت جابر فقط
        </Badge>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6" data-testid="text-hero-title">
          سوق ميت جابر
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto" data-testid="text-hero-subtitle">
          اطلب من متاجر قريتك والقرى المجاورة بسهولة وأمان
        </p>
        
        <div className="max-w-md mx-auto relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="ابحث عن متجر..." 
            className="pl-10 h-12 text-lg rounded-xl shadow-sm"
            data-testid="input-store-search"
          />
        </div>
      </div>
      
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary rounded-full blur-3xl" />
      </div>
    </section>
  );
}
