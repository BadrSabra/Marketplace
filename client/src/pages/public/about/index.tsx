import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Code2 } from "lucide-react";
import { SiLinkedin } from "react-icons/si";

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
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

      <Card className="max-w-4xl mx-auto border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold">
            <Code2 className="h-7 w-7 text-primary" />
            المطوّر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Code2 className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center sm:text-right flex-1">
              <h3 className="text-xl font-bold mb-1">Badr Aldien Sabra</h3>
              <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                Full-Stack Developer responsible for designing and building the Mit Gaber Marketplace platform from scratch, including the orders system, digital wallets, delivery management, and all role-based dashboards.
              </p>
              <a
                href="https://www.linkedin.com/in/badr-aldien-sabra"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A66C2] text-white text-sm font-semibold hover:bg-[#004182] transition-colors"
                data-testid="link-developer-linkedin"
              >
                <SiLinkedin className="h-4 w-4" />
                تواصل على LinkedIn
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
