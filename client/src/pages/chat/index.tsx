import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { MessageCircle, HeadphonesIcon, Store, Truck, ChevronLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface ChatRoom {
  id: string;
  type: "ORDER_STORE" | "ORDER_DRIVER" | "SUPPORT";
  title: string | null;
  referenceId: string | null;
  status: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastSenderName: string | null;
  unreadCount: number;
  participants: { userId: string; name: string; role: string }[];
  createdAt: string;
}

function getRoomIcon(type: string) {
  if (type === "SUPPORT") return <HeadphonesIcon className="w-5 h-5 text-violet-500" />;
  if (type === "ORDER_STORE") return <Store className="w-5 h-5 text-blue-500" />;
  if (type === "ORDER_DRIVER") return <Truck className="w-5 h-5 text-green-500" />;
  return <MessageCircle className="w-5 h-5 text-gray-500" />;
}

function getRoomLabel(type: string) {
  if (type === "SUPPORT") return "دعم فني";
  if (type === "ORDER_STORE") return "المتجر";
  if (type === "ORDER_DRIVER") return "السائق";
  return "دردشة";
}

function getRoomTitle(room: ChatRoom, userId: string) {
  if (room.title) return room.title;
  if (room.type === "SUPPORT") return "الدعم الفني";
  const other = room.participants.find(p => p.userId !== userId);
  return other?.name ?? "محادثة";
}

export default function ChatListPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const handleUnread = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["/api/chat/rooms"] });
  }, [qc]);

  useChatSocket(undefined, handleUnread);

  const { data: rooms, isLoading } = useQuery<ChatRoom[]>({
    queryKey: ["/api/chat/rooms"],
    refetchInterval: 30000,
  });

  const openSupportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/chat/support");
      return res.json();
    },
    onSuccess: (room) => {
      qc.invalidateQueries({ queryKey: ["/api/chat/rooms"] });
      navigate(`/chat/${room.id}`);
    },
  });

  const filtered = (rooms ?? []).filter(r => {
    const title = getRoomTitle(r, user?.id ?? "").toLowerCase();
    return title.includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-primary" />
              الرسائل
            </h1>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openSupportMutation.mutate()}
              disabled={openSupportMutation.isPending}
              data-testid="button-open-support"
              className="gap-1 text-sm"
            >
              <HeadphonesIcon className="w-4 h-4" />
              دعم فني
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث في المحادثات..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-9"
              data-testid="input-chat-search"
            />
          </div>
        </div>

        {/* Room List */}
        <div className="divide-y">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">لا توجد محادثات بعد</p>
              <p className="text-sm mt-1">عند تقديم طلب ستبدأ محادثة مع المتجر تلقائياً</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => openSupportMutation.mutate()}
                disabled={openSupportMutation.isPending}
              >
                <HeadphonesIcon className="w-4 h-4 ml-2" />
                تواصل مع الدعم الفني
              </Button>
            </div>
          ) : (
            filtered.map(room => {
              const title = getRoomTitle(room, user?.id ?? "");
              const timeAgo = room.lastMessageAt
                ? formatDistanceToNow(new Date(room.lastMessageAt), { addSuffix: true, locale: ar })
                : formatDistanceToNow(new Date(room.createdAt), { addSuffix: true, locale: ar });

              return (
                <button
                  key={room.id}
                  data-testid={`chat-room-${room.id}`}
                  onClick={() => navigate(`/chat/${room.id}`)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors text-right"
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    {getRoomIcon(room.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{title}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-sm text-muted-foreground truncate">
                        {room.lastMessage
                          ? (room.lastSenderName ? `${room.lastSenderName}: ${room.lastMessage}` : room.lastMessage)
                          : "ابدأ المحادثة..."}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {room.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs px-1.5 h-5 min-w-5">
                            {room.unreadCount}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {getRoomLabel(room.type)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <ChevronLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
