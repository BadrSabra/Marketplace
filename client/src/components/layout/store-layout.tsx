import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Wallet, 
  LogOut,
  Menu,
  ChevronRight,
  MessageCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Spinner } from "@/components/ui/spinner";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { t } from "@/i18n";

const NAV_ITEMS = [
  { href: "/store/dashboard", label: "store.dashboard.title", icon: LayoutDashboard },
  { href: "/store/dashboard/orders", label: "store.orders.title", icon: ShoppingCart },
  { href: "/store/inventory", label: "store.inventory.title", icon: Package },
  { href: "/store/earnings", label: "store.earnings.title", icon: Wallet },
  { href: "/chat", label: "chat", icon: MessageCircle },
];

export function StoreLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: wallet, isLoading: isWalletLoading } = useQuery<any>({
    queryKey: ["/api/wallet"],
    enabled: !!user,
  });

  const { data: stores } = useQuery<any[]>({
    queryKey: ["/api/stores"],
    enabled: !!user,
  });

  const myStore = stores?.find(s => s.ownerId === user?.id);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="xl" />
      </div>
    );
  }

  if (!user || user.role !== "STORE_OWNER") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex text-foreground" dir="rtl">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-l border-border/50 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10">
        <div className="p-6 text-right">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            {t('store.dashboard.your_store')}
          </h1>
          {myStore && (
            <p className="text-xs text-muted-foreground mt-1 font-medium truncate">
              {myStore.name}
            </p>
          )}
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-6">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/store/dashboard" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                <span className="flex-1 text-right">{t(item.label)}</span>
                {isActive && <ChevronRight className="w-4 h-4 opacity-50 rotate-180" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-border/50 bg-secondary/20">
          <div className="px-4 py-3 mb-4 rounded-xl bg-card border border-border/50 shadow-sm text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{t('store.dashboard.wallet_balance')}</p>
            <p className="text-lg font-bold text-primary">
              {isWalletLoading ? <Spinner size="sm" /> : `${parseFloat(wallet?.balance || "0").toFixed(2)} ج.م`}
            </p>
          </div>

          <div className="flex items-center gap-3 px-2 py-3 mb-2 flex-row-reverse">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden text-right">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{user.role.toLowerCase().replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors flex-row-reverse"
          >
            <LogOut className="w-4 h-4" />
            <span className="flex-1 text-right">{t('auth.login.logout') || 'تسجيل الخروج'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border z-20 flex-row-reverse">
          <div className="flex flex-col text-right">
            <h1 className="text-xl font-bold">{t('store.dashboard.your_store')}</h1>
            {myStore && <p className="text-[10px] text-muted-foreground truncate">{myStore.name}</p>}
          </div>
          <div className="flex items-center gap-4 flex-row-reverse">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] uppercase text-muted-foreground font-bold">{t('store.dashboard.wallet_balance')}</p>
              <p className="text-sm font-bold text-primary">{parseFloat(wallet?.balance || "0").toFixed(2)} ج.م</p>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 bg-secondary rounded-lg text-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
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
                    location === item.href 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-right">{t(item.label)}</span>
                </Link>
              ))}
              <div className="pt-4 mt-2 border-t border-border">
                <div className="flex justify-between items-center px-4 py-3 bg-secondary/30 rounded-xl mb-2 flex-row-reverse">
                  <span className="text-sm font-medium">{t('store.dashboard.wallet_balance')}</span>
                  <span className="font-bold text-primary">{parseFloat(wallet?.balance || "0").toFixed(2)} ج.م</span>
                </div>
                <button 
                  onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-xl flex-row-reverse"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="flex-1 text-right">{t('auth.login.logout') || 'تسجيل الخروج'}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 lg:p-10 text-right">
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
