import { Server as SocketServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { chatService } from "./chat.service";

const JWT_SECRET = process.env.JWT_SECRET!;

export let io: SocketServer;

export function initChatSocket(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("UNAUTHORIZED"));
    try {
      const decoded = jwt.verify(token as string, JWT_SECRET) as { id: string; role: string };
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user as { id: string; role: string };

    socket.on("join_room", async (roomId: string) => {
      try {
        const participants = await chatService.getRoomParticipants(roomId);
        const isParticipant = participants.some(p => p.user_id === user.id);
        if (!isParticipant) {
          socket.emit("error", { message: "غير مصرح بالدخول لهذه الغرفة" });
          return;
        }
        socket.join(roomId);
        await chatService.markRead(roomId, user.id);
      } catch (err) {
        socket.emit("error", { message: "حدث خطأ" });
      }
    });

    socket.on("send_message", async ({ roomId, content }: { roomId: string; content: string }) => {
      try {
        if (!content?.trim()) return;
        const msg = await chatService.sendMessage(roomId, user.id, content.trim());
        io.to(roomId).emit("new_message", msg);

        const participants = await chatService.getRoomParticipants(roomId);
        for (const p of participants) {
          if (p.user_id !== user.id) {
            io.to(`user:${p.user_id}`).emit("unread_update", { roomId });
          }
        }
      } catch (err: any) {
        socket.emit("error", { message: err.message === "NOT_PARTICIPANT" ? "غير مصرح" : "حدث خطأ" });
      }
    });

    socket.on("mark_read", async (roomId: string) => {
      try {
        await chatService.markRead(roomId, user.id);
        socket.emit("marked_read", { roomId });
      } catch {}
    });

    socket.on("leave_room", (roomId: string) => {
      socket.leave(roomId);
    });

    socket.join(`user:${user.id}`);
  });

  return io;
}

export function emitSystemMessage(roomId: string, content: string) {
  if (!io) return;
  io.to(roomId).emit("new_message", {
    id: `system-${Date.now()}`,
    roomId,
    senderId: null,
    content,
    type: "SYSTEM",
    createdAt: new Date().toISOString(),
    senderName: "النظام",
    senderRole: "SYSTEM",
  });
}
