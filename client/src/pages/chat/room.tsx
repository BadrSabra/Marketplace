import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { apiRequest } from "@/lib/queryClient";
import { ArrowRight, Send, Loader2, MoreVertical, Store, Truck, HeadphonesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string | null;
  content: string;
  type: "TEXT" | "SYSTEM";
  createdAt: string;
  senderName: string;
  senderRole: string;
  senderAvatar: string | null;
}

interface ChatRoom {
  id: string;
  type: string;
  title: string | null;
  status: string;
  participants: { userId: string; name: string; role: string }[];
}

function getRoomIcon(type: string) {
  if (type === "SUPPORT") return <HeadphonesIcon className="w-5 h-5" />;
  if (type === "ORDER_STORE") return <Store className="w-5 h-5" />;
  if (type === "ORDER_DRIVER") return <Truck className="w-5 h-5" />;
  return null;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
}

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    if (msg.roomId !== roomId) return;
    setMessages(prev => {
      const exists = prev.some(m => m.id === msg.id);
      if (exists) return prev;
      return [...prev, msg];
    });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [roomId]);

  const { joinRoom, leaveRoom, sendMessage: socketSend, markRead } = useChatSocket(handleNewMessage);

  const { data: rooms } = useQuery<ChatRoom[]>({ queryKey: ["/api/chat/rooms"] });
  const room = rooms?.find(r => r.id === roomId);

  const { isLoading, data: initialMessages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/rooms", roomId, "messages"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/chat/rooms/${roomId}/messages`);
      return res.json();
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 100);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (!roomId) return;
    joinRoom(roomId);
    markRead(roomId);
    qc.invalidateQueries({ queryKey: ["/api/chat/rooms"] });
    return () => leaveRoom(roomId);
  }, [roomId]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    try {
      socketSend(roomId, content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const roomTitle = room?.title ?? "محادثة";
  const otherParticipants = room?.participants.filter(p => p.userId !== user?.id) ?? [];
  const subtitleText = otherParticipants.map(p => p.name).join("، ");

  // Group messages by date
  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.createdAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date, msgs: [msg] });
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/chat")}
          data-testid="button-back-chat"
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            {getRoomIcon(room?.type ?? "")}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{roomTitle}</p>
            {subtitleText && (
              <p className="text-xs text-muted-foreground truncate">{subtitleText}</p>
            )}
          </div>
        </div>
        {room?.status === "CLOSED" && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">مغلقة</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <Skeleton className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-48" : "w-36")} />
              </div>
            ))}
          </div>
        ) : groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
              {getRoomIcon(room?.type ?? "")}
            </div>
            <p className="font-medium">ابدأ المحادثة</p>
            <p className="text-sm mt-1">لم يتم إرسال أي رسائل بعد</p>
          </div>
        ) : (
          groupedMessages.map(({ date, msgs }) => (
            <div key={date}>
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground px-2">{date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {msgs.map((msg, idx) => {
                const isMe = msg.senderId === user?.id;
                const isSystem = msg.type === "SYSTEM";
                const showName = !isMe && !isSystem && idx === 0 || (
                  !isMe && !isSystem && msgs[idx - 1]?.senderId !== msg.senderId
                );

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <span className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    data-testid={`message-${msg.id}`}
                    className={cn(
                      "flex flex-col mb-1",
                      isMe ? "items-end" : "items-start"
                    )}
                  >
                    {showName && (
                      <span className="text-xs text-muted-foreground mb-0.5 px-1">{msg.senderName}</span>
                    )}
                    <div
                      className={cn(
                        "max-w-[75%] px-4 py-2 rounded-2xl text-sm leading-relaxed",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-tl-sm"
                          : "bg-muted text-foreground rounded-tr-sm"
                      )}
                    >
                      {msg.content}
                    </div>
                    <span className="text-xs text-muted-foreground mt-0.5 px-1">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {room?.status !== "CLOSED" && (
        <div className="border-t px-4 py-3 bg-background">
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              data-testid="button-send-message"
              className="flex-shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالة..."
              className="flex-1"
              data-testid="input-message"
              autoFocus
            />
          </div>
        </div>
      )}
    </div>
  );
}
