import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, User, Store, Truck, ArrowLeft, Phone } from "lucide-react";
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
  const [identifierMode, setIdentifierMode] = useState<"email" | "phone">("email");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
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
      const payload: any = {
        name: formData.name,
        password: formData.password,
        role: formData.role,
        extra: formData.extra,
      };
      if (identifierMode === "email") {
        payload.email = formData.email;
      } else {
        payload.phone = formData.phone;
      }

      const result = await register(payload);
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
              onClick={() => setLocation("/login")}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all"
            >
              العودة لتسجيل الدخول
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
                <User className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{t("auth.register.title")}</h1>
              <p className="text-muted-foreground">{t("auth.register.subtitle")}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Name */}
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
                    data-testid="input-name"
                    required
                  />
                </div>
              </div>

              {/* Identifier toggle tabs */}
              <div className="space-y-2 text-right">
                <label className="text-sm font-medium text-foreground">طريقة التواصل</label>
                <div className="flex rounded-xl border-2 border-border/80 overflow-hidden bg-background">
                  <button
                    type="button"
                    onClick={() => setIdentifierMode("email")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all ${
                      identifierMode === "email"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                    data-testid="tab-email"
                  >
                    <Mail className="w-4 h-4" />
                    بريد إلكتروني
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdentifierMode("phone")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all ${
                      identifierMode === "phone"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                    data-testid="tab-phone"
                  >
                    <Phone className="w-4 h-4" />
                    رقم الهاتف
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {identifierMode === "email" ? (
                    <motion.div
                      key="email"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="relative"
                    >
                      <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input 
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full pr-12 pl-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all text-right"
                        placeholder={t("auth.register.email_placeholder")}
                        data-testid="input-email"
                        required
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="phone"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="relative"
                    >
                      <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input 
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pr-12 pl-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all text-right"
                        placeholder={t("auth.register.phone_placeholder")}
                        data-testid="input-phone"
                        required
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Password */}
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
                    data-testid="input-password"
                    required
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-2 text-right">
                <label className="text-sm font-medium text-foreground">{t("auth.register.role_label")}</label>
                <Select 
                  value={formData.role} 
                  onValueChange={(val) => setFormData({ ...formData, role: val })}
                >
                  <SelectTrigger className="w-full h-12 rounded-xl border-2 text-right" data-testid="select-role">
                    <SelectValue placeholder={t("auth.register.role_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">{t("auth.register.roles.customer")}</SelectItem>
                    <SelectItem value="STORE_OWNER">{t("auth.register.roles.store_owner")}</SelectItem>
                    <SelectItem value="DRIVER">{t("auth.register.roles.driver")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Store-owner extra fields */}
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
                        data-testid="input-store-name"
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
                      data-testid="input-store-type"
                      required
                    />
                  </div>
                </motion.div>
              )}

              {/* Driver extra fields */}
              {formData.role === "DRIVER" && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: "auto", opacity: 1 }}
                  className="space-y-2 pt-2"
                >
                  <label className="text-sm font-medium text-foreground">{t("auth.register.transport_type_label")}</label>
                  <div className="relative">
                    <Truck className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input 
                      type="text"
                      value={formData.extra.transportType}
                      onChange={(e) => setFormData({ ...formData, extra: { ...formData.extra, transportType: e.target.value } })}
                      className="w-full pr-12 pl-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all text-right"
                      placeholder={t("auth.register.transport_type_placeholder")}
                      data-testid="input-transport-type"
                      required
                    />
                  </div>
                </motion.div>
              )}

              <button 
                type="submit"
                disabled={isRegistering}
                data-testid="button-register-submit"
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 mt-2"
              >
                {isRegistering ? t("auth.register.submitting") : t("auth.register.submit")}
                {!isRegistering && <ArrowLeft className="w-5 h-5" />}
              </button>

              <p className="text-center text-sm text-muted-foreground">
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
