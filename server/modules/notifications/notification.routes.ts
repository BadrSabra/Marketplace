import { Router, Request, Response } from "express";
import { authenticate } from "../../middleware/auth";
import { pushService } from "./push.service";
import { z } from "zod";

const router = Router();

router.get("/vapid-public-key", (_req: Request, res: Response) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ message: "Push notifications not configured" });
  res.json({ publicKey: key });
});

router.post("/push-subscription", authenticate, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
    });
    const { endpoint, keys } = schema.parse(req.body);
    const userId = (req as any).user.id;
    await pushService.savePushSubscription(userId, endpoint, keys.p256dh, keys.auth);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/push-subscription", authenticate, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    const userId = (req as any).user.id;
    if (endpoint) {
      await pushService.removePushSubscription(userId, endpoint);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const items = await pushService.getUserNotifications(userId, limit, offset);
    const unreadCount = await pushService.getUnreadCount(userId);
    res.json({ notifications: items, unreadCount });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/unread-count", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const count = await pushService.getUnreadCount(userId);
    res.json({ count });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/read-all", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    await pushService.markAllAsRead(userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id/read", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = req.params.id as string;
    await pushService.markAsRead(id, userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
