import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Temporary i18n mock until a full provider is setup
const t = (key: string) => {
  const translations: any = {
    "auth.login.title": "بوابة المسؤول",
    "auth.login.subtitle": "تسجيل الدخول لإدارة متجرك",
    "auth.login.email_label": "البريد الإلكتروني",
    "auth.login.email_placeholder": "admin@example.com",
    "auth.login.password_label": "كلمة المرور",
    "auth.login.password_placeholder": "••••••••",
    "auth.login.submit": "تسجيل الدخول",
    "auth.login.submitting": "جاري تسجيل الدخول...",
    "auth.login.no_account": "ليس لديك حساب؟",
    "auth.login.register_link": "إنشاء حساب",
    "auth.login.success_title": "مرحباً بك مجدداً!",
    "auth.login.success_desc": "تم تسجيل الدخول بنجاح.",
    "auth.login.failed_title": "فشل تسجيل الدخول",
    "auth.login.failed_desc": "بيانات الاعتماد غير صالحة"
  };
  return translations[key] || key;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { login, isLoggingIn } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password });
      toast({ title: t("auth.login.success_title"), description: t("auth.login.success_desc") });
      setLocation("/");
    } catch (error: any) {
      toast({ 
        title: t("auth.login.failed_title"), 
        description: error.message || t("auth.login.failed_desc"),
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden" dir="rtl">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-card rounded-3xl premium-shadow border border-border/50 p-8 md:p-10 relative z-10"
      >
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
            <Lock className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">{t("auth.login.title")}</h1>
          <p className="text-muted-foreground">{t("auth.login.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2 text-right">
            <label className="text-sm font-medium text-foreground">{t("auth.login.email_label")}</label>
            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pr-12 pl-4 py-3.5 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 text-right"
                placeholder={t("auth.login.email_placeholder")}
                required
              />
            </div>
          </div>

          <div className="space-y-2 text-right">
            <label className="text-sm font-medium text-foreground">{t("auth.login.password_label")}</label>
            <div className="relative">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pr-12 pl-4 py-3.5 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 text-right"
                placeholder={t("auth.login.password_placeholder")}
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isLoggingIn ? t("auth.login.submitting") : t("auth.login.submit")}
            {!isLoggingIn && <ArrowLeft className="w-5 h-5" />}
          </button>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.login.no_account")}{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              {t("auth.login.register_link")}
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}

