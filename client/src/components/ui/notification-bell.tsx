import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/use-notifications";
import { useAuth } from "@/hooks/use-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const typeIcons: Record<string, string> = {
  NEW_ORDER: "🛒",
  ORDER_STATUS_UPDATE: "📦",
  NEW_OFFER: "🚗",
  OFFER_ACCEPTED: "✅",
  OFFER_REJECTED: "❌",
  OFFER_COUNTERED: "💬",
  ACCOUNT_APPROVED: "🎉",
  DEPOSIT_APPROVED: "💰",
  DEPOSIT_REJECTED: "🚫",
  WITHDRAWAL_APPROVED: "💸",
  WITHDRAWAL_REJECTED: "🚫",
  WALLET_UPDATE: "💳",
  SYSTEM_ALERT: "ℹ️",
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.id);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80" dir="rtl">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="font-semibold text-sm">الإشعارات</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              قراءة الكل
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              لا توجد إشعارات
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={`flex flex-col items-start gap-0.5 px-3 py-2.5 cursor-pointer ${
                  !n.isRead ? "bg-primary/5" : ""
                }`}
                onClick={() => {
                  if (!n.isRead) markAsRead(n.id);
                }}
                data-testid={`notification-item-${n.id}`}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="text-base">{typeIcons[n.type] || "🔔"}</span>
                  <span className="font-medium text-sm flex-1">{n.title}</span>
                  {!n.isRead && (
                    <Badge variant="destructive" className="h-1.5 w-1.5 rounded-full p-0 min-w-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground pr-7 leading-snug">{n.body}</p>
                <span className="text-[10px] text-muted-foreground/60 pr-7">
                  {timeAgo(n.createdAt)}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="py-1 text-center">
              <span className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : "كل الإشعارات مقروءة"}
              </span>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
