import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, LayoutDashboard, Menu, X, ShoppingCart, Package, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/chat/unread"],
    enabled: !!user,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/">
            <a className="flex items-center space-x-2 font-bold text-xl md:text-2xl text-primary" data-testid="link-home">
              <span>سوق ميت جابر</span>
            </a>
          </Link>

          <div className="hidden md:flex gap-6 text-sm font-medium">
            <Link href="/stores">
              <span className="hover:text-primary transition-colors cursor-pointer" data-testid="link-market">السوق</span>
            </Link>
            <Link href="/how-it-works">
              <span className="hover:text-primary transition-colors cursor-pointer" data-testid="link-how-it-works">كيف يعمل</span>
            </Link>
            <Link href="/about">
              <span className="hover:text-primary transition-colors cursor-pointer" data-testid="link-about">من نحن</span>
            </Link>
            <Link href="/faq">
              <span className="hover:text-primary transition-colors cursor-pointer" data-testid="link-faq">الأسئلة الشائعة</span>
            </Link>
            <Link href="/register?role=STORE_OWNER">
              <span className="hover:text-primary transition-colors cursor-pointer" data-testid="link-register-store">تسجيل متجر</span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Chat Icon - visible when logged in */}
          {user && (
            <Link href="/chat">
              <Button variant="ghost" size="icon" className="relative" data-testid="button-chat">
                <MessageCircle className="h-5 w-5" />
                {(unreadData?.count ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {(unreadData?.count ?? 0) > 9 ? "9+" : unreadData?.count}
                  </span>
                )}
              </Button>
            </Link>
          )}

          {/* Cart Icon - visible when customer is logged in */}
          {user && (user as any).role === "CUSTOMER" && (
            <Link href="/customer/cart">
              <Button variant="ghost" size="icon" className="relative" data-testid="button-cart">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </Button>
            </Link>
          )}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full" data-testid="button-avatar">
                    <Avatar>
                      <AvatarImage src={user.avatarUrl || ""} alt={user.name} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>لوحة التحكم</span>
                    </Link>
                  </DropdownMenuItem>
                  {(user as any).role === "CUSTOMER" && (
                    <DropdownMenuItem asChild>
                      <Link href="/customer/orders" className="flex items-center gap-2 cursor-pointer">
                        <Package className="h-4 w-4" />
                        <span>طلباتي</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/customer/profile" className="flex items-center gap-2 cursor-pointer">
                      <User className="h-4 w-4" />
                      <span>حسابي</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="flex items-center gap-2 cursor-pointer text-destructive"
                    onClick={() => logout()}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" data-testid="button-login">تسجيل الدخول</Button>
                </Link>
                <Link href="/register">
                  <Button data-testid="button-register">إنشاء حساب</Button>
                </Link>
              </div>
            )}
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-background p-4 space-y-4 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col gap-4">
            <Link href="/stores">
              <span className="text-lg font-medium cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>السوق</span>
            </Link>
            <Link href="/how-it-works">
              <span className="text-lg font-medium cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>كيف يعمل</span>
            </Link>
            <Link href="/about">
              <span className="text-lg font-medium cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>من نحن</span>
            </Link>
            <Link href="/faq">
              <span className="text-lg font-medium cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>الأسئلة الشائعة</span>
            </Link>
            <Link href="/register?role=STORE_OWNER">
              <span className="text-lg font-medium cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>تسجيل متجر</span>
            </Link>
            <hr />
            {user ? (
              <>
                <Link href="/">
                  <span className="text-lg font-medium cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>لوحة التحكم</span>
                </Link>
                {(user as any).role === "CUSTOMER" && (
                  <Link href="/customer/orders">
                    <span className="text-lg font-medium cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>طلباتي</span>
                  </Link>
                )}
                <Link href="/customer/profile">
                  <span className="text-lg font-medium cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>حسابي</span>
                </Link>
                <Button 
                  variant="destructive" 
                  className="w-full justify-start" 
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  تسجيل الخروج
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/login">
                  <Button variant="outline" className="w-full" onClick={() => setIsMobileMenuOpen(false)}>تسجيل الدخول</Button>
                </Link>
                <Link href="/register">
                  <Button className="w-full" onClick={() => setIsMobileMenuOpen(false)}>إنشاء حساب</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
