import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-3xl font-bold">
            <Info className="h-8 w-8 text-primary" />
            حول المشروع
          </CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert lg:prose-xl">
          <p className="text-muted-foreground text-lg leading-relaxed">
            مرحباً بكم في منصتنا المتطورة للتوصيل والخدمات اللوجستية. نحن نسعى لتقديم تجربة فريدة تربط بين المتاجر المحلية، السائقين، والعملاء في نظام واحد متكامل يتسم بالشفافية والأمان.
          </p>
          
          <h3 className="mt-8 mb-4 font-semibold text-2xl">رؤيتنا</h3>
          <p>
            أن نكون الشريك اللوجستي الأول في المنطقة، من خلال توظيف التكنولوجيا لتبسيط عمليات الشراء والتوصيل ودعم الاقتصاد المحلي.
          </p>

          <h3 className="mt-8 mb-4 font-semibold text-2xl">لماذا نحن؟</h3>
          <ul className="list-disc pr-6 space-y-2">
            <li>دعم المتاجر المحلية وتوفير منصة سهلة لإدارة المنتجات.</li>
            <li>نظام محفظة إلكترونية متطور يضمن حقوق جميع الأطراف.</li>
            <li>تتبع مباشر للطلبات وتواصل فعال بين السائق والعميل.</li>
            <li>نظام عمولات عادل يشجع السائقين على تقديم أفضل خدمة.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
