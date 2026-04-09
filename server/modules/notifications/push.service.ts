import webpush from "web-push";
import { db } from "../../db";
import { notifications, pushSubscriptions, users } from "@shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
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

      await this.sendWebPush(data.userId, data.title, data.body, { ...(data.data || {}), type: data.type });
    } catch (err) {
      console.error("[PushService] Failed to create notification:", err);
    }
  }

  async sendWebPush(userId: string, title: string, body: string, data: Record<string, any> = {}): Promise<void> {
    try {
      const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));

      const payload = JSON.stringify({ title, body, data });

      // Q: لماذا نُضيف retry محدود (مرة واحدة) لأخطاء الشبكة العابرة؟
      // A: الكود القديم كان fire-and-forget بلا retry: أي خطأ شبكة عابر (timeout، ECONNRESET)
      //    يُفقد الإشعار إلى الأبد دون أي محاولة ثانية. مزودو web push (FCM, APNS) يُوصون
      //    بـ exponential backoff للأخطاء 429 و5xx. نُضيف retry واحدة بعد 1 ثانية للأخطاء
      //    القابلة للاسترداد، ونحذف الـ subscriptions منتهية الصلاحية (410/404) فوراً.
      //
      // ⚠️ خطأ جديد تكشفه هذا الإصلاح:
      //    إذا كان مزود الـ push يُطبّق rate limiting صارم، الـ retry قد يُسبب HTTP 429
      //    مرتين بدلاً من مرة. الحل الكامل: exponential backoff مع jitter وqueue مركزي،
      //    لكن هذا أعقد مما يحتاجه المشروع الحالي.
      const failed: string[] = [];

      const sendWithRetry = async (sub: typeof subs[0]): Promise<void> => {
        const pushConfig = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
        try {
          await webpush.sendNotification(pushConfig, payload);
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired or invalid — mark for cleanup, no retry
            failed.push(sub.id);
          } else {
            // Transient error (5xx, network) — retry once after 1 second
            await new Promise(res => setTimeout(res, 1000));
            try {
              await webpush.sendNotification(pushConfig, payload);
            } catch (retryErr: any) {
              if (retryErr.statusCode === 410 || retryErr.statusCode === 404) {
                failed.push(sub.id);
              } else {
                console.warn(`[PushService] Web push failed after retry for sub ${sub.id}:`, retryErr.message);
              }
            }
          }
        }
      };

      await Promise.allSettled(subs.map(sendWithRetry));

      // Q: هل يمكن استخدام sql`id = ANY(${failed})` لحذف subscriptions منتهية الصلاحية؟
      // A: لا — هذا خطأ. sql template tag في Drizzle يُرسل المصفوفة كقيمة مُعامَلة واحدة،
      //    لكن PostgreSQL يتوقع أن `ANY(...)` تستقبل type-cast array صريح. النتيجة:
      //    استعلام SQL معطوب لا يحذف أي سجل، مما يتراكم فيه push subscriptions منتهية
      //    الصلاحية إلى الأبد ويُسبب رسائل خطأ 410/404 متكررة مع مزود الـ web push.
      //    الإصلاح: استخدام inArray() من Drizzle ORM وهي الطريقة الآمنة والموثوقة.
      if (failed.length > 0) {
        await db.delete(pushSubscriptions).where(
          inArray(pushSubscriptions.id, failed)
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

  async getAdminUserIds(): Promise<string[]> {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "ADMIN"));
    return admins.map((a) => a.id);
  }

  async getApprovedDriverIds(): Promise<string[]> {
    const drivers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "DRIVER"), eq(users.isApproved, true)));
    return drivers.map((d) => d.id);
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

export async function notifyAdmins(
  type: InsertNotification["type"],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  const adminIds = await pushService.getAdminUserIds();
  await Promise.allSettled(
    adminIds.map((adminId) =>
      pushService.createNotification({ userId: adminId, type, title, body, data, isRead: false })
    )
  );
}

export async function notifyAllDrivers(
  type: InsertNotification["type"],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  const driverIds = await pushService.getApprovedDriverIds();
  await Promise.allSettled(
    driverIds.map((driverId) =>
      pushService.createNotification({ userId: driverId, type, title, body, data, isRead: false })
    )
  );
}
