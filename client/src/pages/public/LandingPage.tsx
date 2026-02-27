import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import StoreGrid from "@/components/home/StoreGrid";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <HeroSection />
        
        <div className="container py-8">
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="font-medium" data-testid="banner-hyperlocal-notice">
              نخدم حالياً قرية ميت جابر والمناطق المجاورة فقط
            </AlertDescription>
          </Alert>

          <section className="py-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold tracking-tight">المتاجر المتاحة</h2>
            </div>
            <StoreGrid />
          </section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
