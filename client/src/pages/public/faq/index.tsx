import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function FAQPage() {
  const faqs = [
    {
      question: "كيف يمكنني البدء كعميل؟",
      answer: "يمكنك إنشاء حساب جديد، شحن محفظتك، ثم البدء بتصفح المتاجر المتاحة واختيار المنتجات التي ترغب في شرائها."
    },
    {
      question: "كيف يعمل نظام المحفظة؟",
      answer: "تعمل المحفظة كوسيلة دفع أساسية. يمكنك إيداع الأموال من خلال المشرف، واستخدام الرصيد للدفع مقابل الطلبات. يتم حجز قيمة الطلب حتى إتمام التسليم لضمان الأمان."
    },
    {
      question: "أنا صاحب متجر، كيف أعرض منتجاتي؟",
      answer: "بعد التسجيل كصاحب متجر والموافقة على حسابك، يمكنك الدخول إلى لوحة التحكم وإضافة متجرك ومنتجاتك بكل سهولة."
    },
    {
      question: "كيف أصبح سائقاً في المنصة؟",
      answer: "قم بالتسجيل واختيار دور 'سائق'، وارفاق الوثائق المطلوبة. بمجرد مراجعة طلبك والموافقة عليه، ستتمكن من استقبال طلبات التوصيل وتقديم عروض الأسعار."
    },
    {
      question: "ما هو نظام العروض للسائقين؟",
      answer: "عندما يطلب العميل توصيلاً، يظهر الطلب للسائقين المتاحين. يمكن لكل سائق تقديم عرض سعر للتوصيل، ويقوم العميل أو النظام باختيار العرض الأنسب."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950" dir="rtl">
      <Navbar />

      <main className="flex-grow container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl font-bold">
              <HelpCircle className="h-8 w-8 text-primary" />
              الأسئلة الشائعة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-right text-lg font-medium">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-base leading-relaxed text-right">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
