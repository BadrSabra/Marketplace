import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Users, 
  Store as StoreIcon, 
  Package, 
  ShoppingCart,
  LogOut,
  Menu,
  ShieldAlert,
  Wallet,
  ArrowDownLeft,
  MessageCircle,
  BarChart3,
  UserCheck
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Spinner } from "@/components/ui/spinner";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// BUG-FIX: "/stores" was linking to the PUBLIC stores page (PublicStoresPage) visible to all
// visitors, not the admin store management page at "/admin/stores".
// Similarly "/products" and "/orders" had no role restrictions and were accessible to any
// authenticated user. All admin nav items now point to the correct admin-scoped routes.
const NAV_ITEMS = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/admin/finance", label: "المالية", icon: BarChart3 },
  { href: "/admin/approvals", label: "طلبات الموافقة", icon: UserCheck },
  { href: "/admin/deposits", label: "طلبات الإيداع", icon: Wallet },
  { href: "/admin/withdrawals", label: "طلبات السحب", icon: ArrowDownLeft },
  { href: "/admin/audit", label: "سجلات التدقيق", icon: ShieldAlert },
  { href: "/admin/users", label: "المستخدمون", icon: Users },
  { href: "/admin/stores", label: "المتاجر", icon: StoreIcon },
  { href: "/admin/products", label: "المنتجات", icon: Package },
  { href: "/admin/orders", label: "الطلبات", icon: ShoppingCart },
  { href: "/chat", label: "الرسائل", icon: MessageCircle },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="xl" />
      </div>
    );
  }

  if (!user) {
    return null; // The ProtectedRoute component in App.tsx handles redirect
  }

  return (
    <div className="min-h-screen bg-background flex text-foreground" dir="rtl">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-l border-border/50 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10">
        <div className="p-6 text-right">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            ميت جابر
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">لوحة الإدارة</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-6">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium flex-row-reverse",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                <span className="flex-1 text-right">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-border/50 bg-secondary/20">
          <div className="flex items-center gap-3 px-2 py-3 mb-2 flex-row-reverse">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden text-right">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">مدير النظام</p>
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors flex-row-reverse"
          >
            <LogOut className="w-4 h-4" />
            <span className="flex-1 text-right">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border z-20 flex-row-reverse">
          <div className="text-right">
            <h1 className="text-xl font-bold">ميت جابر</h1>
            <p className="text-[10px] text-muted-foreground">لوحة الإدارة</p>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 bg-secondary rounded-lg text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden absolute top-[73px] left-0 right-0 bg-card border-b border-border shadow-lg z-20 p-4 space-y-2"
            >
              {NAV_ITEMS.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all flex-row-reverse",
                    location === item.href || (item.href !== "/" && location.startsWith(item.href))
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-right">{item.label}</span>
                </Link>
              ))}
              <button 
                onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-xl flex-row-reverse"
              >
                <LogOut className="w-5 h-5" />
                <span className="flex-1 text-right">تسجيل الخروج</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 lg:p-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
