import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getChatSocket } from "./use-chat-socket";
import { io, Socket } from "socket.io-client";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: string;
};

let globalNotifSocket: Socket | null = null;

function getOrCreateSocket(): Socket | null {
  const token = localStorage.getItem("jwt_token");
  if (!token) return null;
  const existing = getChatSocket();
  if (existing && existing.connected) return existing;
  if (!globalNotifSocket || !globalNotifSocket.connected) {
    globalNotifSocket = io(window.location.origin, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });
  }
  return globalNotifSocket;
}

async function registerPushSubscription(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const res = await fetch("/api/notifications/vapid-public-key");
    if (!res.ok) return;
    const { publicKey } = await res.json();
    if (!publicKey) return;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const subJson = subscription.toJSON();
    await apiRequest("POST", "/api/notifications/push-subscription", {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
      },
    });
  } catch (err) {
    console.warn("[Push] Could not register push subscription:", err);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestPushPermission(): Promise<void> {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "denied") return;

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }

    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      await registerPushSubscription();
    }
  } catch (err) {
    console.warn("[Push] Permission request failed:", err);
  }
}

export function useNotifications(userId: string | undefined) {
  const [localNotifications, setLocalNotifications] = useState<AppNotification[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const hasRequestedPermission = useRef(false);

  const { data, isLoading } = useQuery<{ notifications: AppNotification[]; unreadCount: number }>({
    queryKey: ["/api/notifications"],
    enabled: !!userId,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  useEffect(() => {
    if (data?.notifications) {
      setLocalNotifications(data.notifications);
    }
  }, [data?.notifications]);

  useEffect(() => {
    if (!userId) return;

    if (!hasRequestedPermission.current) {
      hasRequestedPermission.current = true;
      requestPushPermission().catch(console.warn);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const socket = getOrCreateSocket();
    if (!socket) return;
    socketRef.current = socket;

    const handleNotification = (notification: AppNotification) => {
      setLocalNotifications((prev) => {
        const exists = prev.find((n) => n.id === notification.id);
        if (exists) return prev;
        return [notification, ...prev];
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(notification.title, {
            body: notification.body,
            icon: "/favicon.png",
            dir: "rtl",
            lang: "ar",
          });
        } catch {}
      }
    };

    socket.on("notification", handleNotification);
    return () => {
      socket.off("notification", handleNotification);
    };
  }, [userId]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/notifications/${id}/read`);
    },
    onSuccess: (_, id) => {
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/notifications/read-all");
    },
    onSuccess: () => {
      setLocalNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = localNotifications.filter((n) => !n.isRead).length;

  return {
    notifications: localNotifications,
    unreadCount,
    isLoading,
    markAsRead: (id: string) => markAsRead.mutate(id),
    markAllAsRead: () => markAllAsRead.mutate(),
  };
}
