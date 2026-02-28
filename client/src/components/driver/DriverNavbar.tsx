import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  ClipboardList, 
  Wallet, 
  User, 
  LogOut, 
  Menu,
  CheckCircle2,
  XCircle
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

export default function DriverNavbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isOnline, setIsOnline] = useState(true);

  const navItems = [
    { href: "/driver/tasks", label: "المهام", icon: ClipboardList },
    { href: "/driver/wallet", label: "المحفظة", icon: Wallet },
    { href: "/driver/profile", label: "الملف الشخصي", icon: User },
  ];

  const NavLinks = () => (
    <>
      {navItems.map((item) => (
        <Link key={item.href} href={item.href}>
          <a className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
            location === item.href 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-muted"
          }`}>
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </a>
        </Link>
      ))}
    </>
  );

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/">
            <a className="text-xl font-bold text-primary">Mit Gaber Driver</a>
          </Link>
          
          <div className="hidden md:flex items-center gap-2">
            <NavLinks />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border bg-muted/50">
            {isOnline ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm font-medium">{isOnline ? "متصل" : "غير متصل"}</span>
            <button 
              className="h-6 px-2 text-xs bg-transparent hover:bg-muted rounded"
              onClick={() => setIsOnline(!isOnline)}
            >
              تغيير
            </button>
          </div>

          <div className="hidden md:flex items-center gap-4 border-l pl-4">
            <span className="text-sm font-medium">{user?.name}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => logout()}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>

          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col gap-4 mt-8">
                <NavLinks />
                <Button 
                  variant="destructive" 
                  className="w-full mt-4 justify-start gap-2"
                  onClick={() => logout()}
                >
                  <LogOut className="w-5 h-5" />
                  تسجيل الخروج
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
