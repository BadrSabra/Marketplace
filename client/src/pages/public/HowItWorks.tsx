import { 
  ShoppingBag, 
  Store, 
  Truck, 
  ChevronLeft, 
  CheckCircle2, 
  Wallet, 
  Search, 
  PackageCheck 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const steps = {
  customer: [
    {
      title: "تصفح المتاجر",
      description: "اكتشف أفضل المتاجر المحلية والمنتجات في منطقتك بلمسة واحدة.",
      icon: Search,
    },
    {
      title: "أضف للسلة",
      description: "اختر منتجاتك المفضلة وأضفها لسلة التسوق الخاصة بك.",
      icon: ShoppingBag,
    },
    {
      title: "ادفع واستلم",
      description: "ادفع بأمان عبر المحفظة واستلم طلبك في أسرع وقت ممكن.",
      icon: Wallet,
    },
  ],
  store: [
    {
      title: "سجل متجرك",
      description: "أنشئ حساباً لمتجرك وارفع بياناتك لبدء البيع فوراً.",
      icon: Store,
    },
    {
      title: "أضف منتجاتك",
      description: "اعرض منتجاتك مع الصور والأسعار لجذب العملاء المحليين.",
      icon: PackageCheck,
    },
    {
      title: "استلم الطلبات",
      description: "ابدأ في استقبال الطلبات وتجهيزها للعملاء في منطقتك.",
      icon: CheckCircle2,
    },
  ],
  driver: [
    {
      title: "انضم كقائد",
      description: "سجل بياناتك وانضم لشبكة التوصيل في ميت جابر.",
      icon: Truck,
    },
    {
      title: "اقبل المهمات",
      description: "تصفح طلبات التوصيل المتاحة واقبل ما يناسبك منها.",
      icon: CheckCircle2,
    },
    {
      title: "حقق الأرباح",
      description: "وصل الطلبات واحصل على عمولتك فوراً في محفظتك.",
      icon: Wallet,
    },
  ],
};

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-16">
          
          {/* Header Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
              كيف يعمل متجر ميت جابر؟
            </h1>
            <p className="text-xl text-muted-foreground">
              منصة متكاملة تربط العملاء بالمتاجر المحلية وعمال التوصيل في ميت جابر.
            </p>
          </div>

          {/* Customer Section */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <ShoppingBag className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold">للعملاء</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {steps.customer.map((step, idx) => (
                <Card key={idx} className="border-none shadow-sm bg-muted/30">
                  <CardContent className="pt-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-white dark:bg-black rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <step.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Store Owner Section */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Store className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold">لأصحاب المتاجر</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {steps.store.map((step, idx) => (
                <Card key={idx} className="border-none shadow-sm bg-muted/30">
                  <CardContent className="pt-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-white dark:bg-black rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <step.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Driver Section */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Truck className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold">للمناديب</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {steps.driver.map((step, idx) => (
                <Card key={idx} className="border-none shadow-sm bg-muted/30">
                  <CardContent className="pt-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-white dark:bg-black rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <step.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Call to Action */}
          <div className="bg-primary text-primary-foreground rounded-3xl p-8 text-center space-y-6">
            <h2 className="text-3xl font-bold">جاهز للبدء؟</h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto">
              انضم لآلاف المستخدمين في ميت جابر واستمتع بتجربة تسوق محلية فريدة من نوعها.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Link href="/register">
                <Button size="lg" variant="secondary" className="font-bold text-lg px-8">
                  سجل الآن
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-primary font-bold text-lg px-8">
                  تسجيل الدخول
                </Button>
              </Link>
            </div>
          </div>

          <div className="text-center pt-8">
            <Link href="/">
              <Button variant="ghost" className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                العودة للرئيسية
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
