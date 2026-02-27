import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, LayoutDashboard, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
              <a className="hover:text-primary transition-colors" data-testid="link-market">السوق</a>
            </Link>
            <Link href="/how-it-works">
              <a className="hover:text-primary transition-colors" data-testid="link-how-it-works">كيف يعمل</a>
            </Link>
            <Link href="/register?role=STORE_OWNER">
              <a className="hover:text-primary transition-colors" data-testid="link-register-store">تسجيل متجر</a>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
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
                  <DropdownMenuItem asChild>
                    <Link href="/customer/profile" className="flex items-center gap-2 cursor-pointer">
                      <User className="h-4 w-4" />
                      <span>حسابي</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="flex items-center gap-2 cursor-pointer text-destructive"
                    onClick={() => logoutMutation.mutate()}
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
              <a className="text-lg font-medium" onClick={() => setIsMobileMenuOpen(false)}>السوق</a>
            </Link>
            <Link href="/how-it-works">
              <a className="text-lg font-medium" onClick={() => setIsMobileMenuOpen(false)}>كيف يعمل</a>
            </Link>
            <Link href="/register?role=STORE_OWNER">
              <a className="text-lg font-medium" onClick={() => setIsMobileMenuOpen(false)}>تسجيل متجر</a>
            </Link>
            <hr />
            {user ? (
              <>
                <Link href="/">
                  <a className="text-lg font-medium" onClick={() => setIsMobileMenuOpen(false)}>لوحة التحكم</a>
                </Link>
                <Link href="/customer/profile">
                  <a className="text-lg font-medium" onClick={() => setIsMobileMenuOpen(false)}>حسابي</a>
                </Link>
                <Button 
                  variant="destructive" 
                  className="w-full justify-start" 
                  onClick={() => {
                    logoutMutation.mutate();
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
