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
import { User, LogOut, LayoutDashboard } from "lucide-react";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/">
            <a className="flex items-center space-x-2 font-bold text-2xl text-primary" data-testid="link-home">
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

        <div className="flex items-center gap-4">
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
      </div>
    </nav>
  );
}
