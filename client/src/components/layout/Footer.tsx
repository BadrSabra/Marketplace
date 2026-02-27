import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="border-t bg-slate-50 dark:bg-slate-900 py-8 md:py-12 mt-auto">
      <div className="container grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 px-4">
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-primary">سوق ميت جابر</h3>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            منصة محلية لطلب المنتجات من متاجر قرية ميت جابر والقرى المجاورة مع توصيل سريع وآمن.
          </p>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-semibold">عن المنصة</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/about"><a className="hover:text-primary transition-colors">من نحن</a></Link></li>
            <li><Link href="/how-it-works"><a className="hover:text-primary transition-colors">كيف يعمل</a></Link></li>
            <li><Link href="/faq"><a className="hover:text-primary transition-colors">الأسئلة الشائعة</a></Link></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold">الخدمات</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/register?role=STORE_OWNER"><a className="hover:text-primary transition-colors">تسجيل متجر</a></Link></li>
            <li><Link href="/register?role=DRIVER"><a className="hover:text-primary transition-colors">كن سائقاً</a></Link></li>
          </ul>
        </div>

        <div className="space-y-4 text-left">
          <h4 className="font-semibold">تواصل معنا</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>info@mitgaber.com</li>
            <li>+20 123 456 7890</li>
          </ul>
        </div>
      </div>
      
      <div className="container mt-8 md:mt-12 pt-8 border-t text-center text-xs md:text-sm text-muted-foreground px-4">
        <p>جميع الحقوق محفوظة © {new Date().getFullYear()} Mit Gaber Market</p>
      </div>
    </footer>
  );
}
