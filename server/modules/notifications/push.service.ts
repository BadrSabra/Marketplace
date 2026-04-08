import webpush from "web-push";
import { db } from "../../db";
import { notifications, pushSubscriptions } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import type { InsertNotification } from "@shared/schema";
import { io } from "../chat/chat.socket";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@mitgaber.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export class PushService {
  async createNotification(data: InsertNotification): Promise<void> {
    try {
      const [notification] = await db.insert(notifications).values(data).returning();

      if (io) {
        io.to(`user:${data.userId}`).emit("notification", {
          id: notification.id,
          type: data.type,
          title: data.title,
          body: data.body,
          data: data.data,
          isRead: false,
          createdAt: notification.createdAt,
        });
      }

      await this.sendWebPush(data.userId, data.title, data.body, data.data || {});
    } catch (err) {
      console.error("[PushService] Failed to create notification:", err);
    }
  }

  async sendWebPush(userId: string, title: string, body: string, data: Record<string, any> = {}): Promise<void> {
    try {
      const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));

      const payload = JSON.stringify({ title, body, data });

      const failed: string[] = [];
      await Promise.allSettled(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
          } catch (err: any) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              failed.push(sub.id);
            }
          }
        })
      );

      if (failed.length > 0) {
        await db.delete(pushSubscriptions).where(
          sql`id = ANY(${failed})`
        );
      }
    } catch (err) {
      console.error("[PushService] Web push error:", err);
    }
  }

  async getUserNotifications(userId: string, limit = 20, offset = 0) {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(result?.count || 0);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async markAllAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async savePushSubscription(userId: string, endpoint: string, p256dh: string, auth: string): Promise<void> {
    await db
      .insert(pushSubscriptions)
      .values({ userId, endpoint, p256dh, auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh, auth },
      });
  }

  async removePushSubscription(userId: string, endpoint: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  }
}

export const pushService = new PushService();

export async function notifyUser(
  userId: string,
  type: InsertNotification["type"],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  await pushService.createNotification({ userId, type, title, body, data, isRead: false });
}
