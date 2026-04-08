import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Lock, Mail, User, Store, Truck, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { t } from "@/i18n";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "CUSTOMER",
    extra: {
      storeName: "",
      storeType: "",
      transportType: "",
    }
  });
  
  const [, setLocation] = useLocation();
  const [pendingApproval, setPendingApproval] = useState(false);
  const { register, isRegistering } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await register(formData);
      if (result?.pendingApproval) {
        setPendingApproval(true);
        toast({
          title: "طلب قيد المراجعة",
          description: result.message || "سيتم مراجعة طلبك والموافقة عليه قريباً.",
        });
      } else {
        toast({ title: t("auth.register.success_title"), description: t("auth.register.success_desc") });
        setLocation("/");
      }
    } catch (error: any) {
      toast({ 
        title: t("auth.register.failed_title"), 
        description: error.message || t("auth.register.failed_desc"),
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden" dir="rtl">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-card rounded-3xl premium-shadow border border-border/50 p-8 md:p-10 relative z-10"
      >
        {pendingApproval ? (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground">طلبك قيد المراجعة</h2>
            <p className="text-muted-foreground leading-relaxed">تم تسجيل حسابك بنجاح. سيتم مراجعته من قِبل الإدارة وإعلامك عند الموافقة.</p>
            <button
              onClick={() => setLocation("/auth/login")}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all"
            >
              العودة لتسجيل الدخول
            </button>
          </div>
        ) : (
        <>
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t("auth.register.title")}</h1>
          <p className="text-muted-foreground">{t("auth.register.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 text-right">
            <label className="text-sm font-medium text-foreground">{t("auth.register.name_label")}</label>
            <div className="relative">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full pr-12 pl-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all text-right"
                placeholder={t("auth.register.name_placeholder")}
                required
              />
            </div>
          </div>

          <div className="space-y-2 text-right">
            <label className="text-sm font-medium text-foreground">{t("auth.register.email_label")}</label>
            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pr-12 pl-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all text-right"
                placeholder={t("auth.register.email_placeholder")}
                required
              />
            </div>
          </div>

          <div className="space-y-2 text-right">
            <label className="text-sm font-medium text-foreground">{t("auth.register.password_label")}</label>
            <div className="relative">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="password" 
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pr-12 pl-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all text-right"
                placeholder={t("auth.register.password_placeholder")}
                required
              />
            </div>
          </div>

          <div className="space-y-2 text-right">
            <label className="text-sm font-medium text-foreground">{t("auth.register.role_label")}</label>
            <Select 
              value={formData.role} 
              onValueChange={(val) => setFormData({ ...formData, role: val })}
            >
              <SelectTrigger className="w-full h-12 rounded-xl border-2 text-right">
                <SelectValue placeholder={t("auth.register.role_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOMER">{t("auth.register.roles.customer")}</SelectItem>
                <SelectItem value="STORE_OWNER">{t("auth.register.roles.store_owner")}</SelectItem>
                <SelectItem value="DRIVER">{t("auth.register.roles.driver")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.role === "STORE_OWNER" && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: "auto", opacity: 1 }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-2 text-right">
                <label className="text-sm font-medium text-foreground">{t("auth.register.store_name_label")}</label>
                <div className="relative">
                  <Store className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    type="text" 
                    value={formData.extra.storeName}
                    onChange={(e) => setFormData({ ...formData, extra: { ...formData.extra, storeName: e.target.value } })}
                    className="w-full pr-12 pl-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all text-right"
                    placeholder={t("auth.register.store_name_placeholder")}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2 text-right">
                <label className="text-sm font-medium text-foreground">{t("auth.register.store_type_label")}</label>
                <input 
                  type="text" 
                  value={formData.extra.storeType}
                  onChange={(e) => setFormData({ ...formData, extra: { ...formData.extra, storeType: e.target.value } })}
                  className="w-full px-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all text-right"
                  placeholder={t("auth.register.store_type_placeholder")}
                  required
                />
              </div>
            </motion.div>
          )}

          {formData.role === "DRIVER" && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: "auto", opacity: 1 }}
              className="space-y-2 pt-2"
            >
              <label className="text-sm font-medium text-foreground text-right block">{t("auth.register.transport_type_label")}</label>
              <div className="relative">
                <Truck className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input 
                  type="text" 
                  value={formData.extra.transportType}
                  onChange={(e) => setFormData({ ...formData, extra: { ...formData.extra, transportType: e.target.value } })}
                  className="w-full pr-12 pl-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all text-right"
                  placeholder={t("auth.register.transport_type_placeholder")}
                  required
                />
              </div>
            </motion.div>
          )}

          <button 
            type="submit"
            disabled={isRegistering}
            className="w-full flex items-center justify-center gap-2 py-4 mt-4 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 transition-all"
          >
            {isRegistering ? t("auth.register.submitting") : t("auth.register.submit")}
            {!isRegistering && <ArrowLeft className="w-5 h-5" />}
          </button>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {t("auth.register.has_account")}{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              {t("auth.register.login_link")}
            </Link>
          </p>
        </form>
        </>
        )}
      </motion.div>
    </div>
  );
}
