import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { queryClient } from "@/lib/queryClient";

let globalSocket: Socket | null = null;

export function getChatSocket(): Socket | null {
  return globalSocket;
}

export function useChatSocket(onMessage?: (msg: any) => void, onUnreadUpdate?: () => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) return;

    if (!globalSocket || !globalSocket.connected) {
      globalSocket = io(window.location.origin, {
        path: "/socket.io",
        auth: { token },
        transports: ["websocket", "polling"],
      });
    }

    socketRef.current = globalSocket;

    if (onMessage) {
      globalSocket.on("new_message", onMessage);
    }
    if (onUnreadUpdate) {
      globalSocket.on("unread_update", onUnreadUpdate);
    }

    return () => {
      if (onMessage) globalSocket?.off("new_message", onMessage);
      if (onUnreadUpdate) globalSocket?.off("unread_update", onUnreadUpdate);
    };
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    globalSocket?.emit("join_room", roomId);
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    globalSocket?.emit("leave_room", roomId);
  }, []);

  const sendMessage = useCallback((roomId: string, content: string) => {
    globalSocket?.emit("send_message", { roomId, content });
  }, []);

  const markRead = useCallback((roomId: string) => {
    globalSocket?.emit("mark_read", roomId);
  }, []);

  return { socket: socketRef.current, joinRoom, leaveRoom, sendMessage, markRead };
}
