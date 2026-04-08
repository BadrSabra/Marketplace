import { Request, Response } from "express";
import { chatService } from "./chat.service";

export class ChatController {
  async getMyRooms(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const rooms = await chatService.getRoomsForUser(userId);
      res.json(rooms);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getMessages(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { roomId } = req.params;
      const { before, limit } = req.query;
      const messages = await chatService.getMessages(
        roomId,
        userId,
        limit ? parseInt(limit as string) : 50,
        before as string | undefined
      );
      res.json(messages);
    } catch (err: any) {
      if (err.message === "NOT_PARTICIPANT") return res.status(403).json({ error: "غير مصرح" });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { roomId } = req.params;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "الرسالة لا يمكن أن تكون فارغة" });
      const msg = await chatService.sendMessage(roomId, userId, content.trim());
      res.status(201).json(msg);
    } catch (err: any) {
      if (err.message === "NOT_PARTICIPANT") return res.status(403).json({ error: "غير مصرح" });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async markRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { roomId } = req.params;
      await chatService.markRead(roomId, userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async openSupportRoom(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const room = await chatService.getOrCreateSupportRoom(userId);
      res.json(room);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const count = await chatService.getTotalUnreadCount(userId);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const chatController = new ChatController();
