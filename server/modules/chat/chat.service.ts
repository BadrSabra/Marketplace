import { db, pool } from "../../db";
import { chatRooms, chatParticipants, chatMessages } from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export class ChatService {
  async createRoom(
    type: "ORDER_STORE" | "ORDER_DRIVER" | "SUPPORT",
    participantIds: string[],
    options?: { referenceId?: string; title?: string }
  ) {
    return await db.transaction(async (tx) => {
      const [room] = await tx.insert(chatRooms).values({
        type,
        referenceId: options?.referenceId ?? null,
        title: options?.title ?? null,
        status: "OPEN",
      }).returning();

      for (const userId of participantIds) {
        await tx.insert(chatParticipants).values({ roomId: room.id, userId });
      }

      return room;
    });
  }

  async getOrCreateSupportRoom(userId: string) {
    const existingRooms = await pool.query<{ room_id: string }>(`
      SELECT cp.room_id FROM chat_participants cp
      JOIN chat_rooms cr ON cr.id = cp.room_id
      WHERE cp.user_id = $1 AND cr.type = 'SUPPORT' AND cr.status = 'OPEN'
      LIMIT 1
    `, [userId]);

    if (existingRooms.rows.length > 0) {
      const room = await db.select().from(chatRooms).where(eq(chatRooms.id, existingRooms.rows[0].room_id)).limit(1);
      return room[0];
    }

    const admins = await pool.query<{ id: string }>(`SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`);
    const adminId = admins.rows[0]?.id;
    const participantIds = adminId ? [userId, adminId] : [userId];

    return this.createRoom("SUPPORT", participantIds, { title: "دعم فني" });
  }

  async getRoomsForUser(userId: string) {
    const rows = await pool.query<{
      room_id: string;
      type: string;
      title: string | null;
      reference_id: string | null;
      status: string;
      room_created_at: Date;
      last_message: string | null;
      last_message_at: Date | null;
      last_sender_name: string | null;
      unread_count: string;
    }>(`
      SELECT
        cr.id AS room_id,
        cr.type,
        cr.title,
        cr.reference_id,
        cr.status,
        cr.created_at AS room_created_at,
        lm.content AS last_message,
        lm.created_at AS last_message_at,
        lm_user.name AS last_sender_name,
        (
          SELECT COUNT(*)::TEXT FROM chat_messages cm2
          WHERE cm2.room_id = cr.id
          AND (cp.last_read_at IS NULL OR cm2.created_at > cp.last_read_at)
          AND cm2.sender_id != $1
        ) AS unread_count
      FROM chat_participants cp
      JOIN chat_rooms cr ON cr.id = cp.room_id
      LEFT JOIN LATERAL (
        SELECT cm.content, cm.created_at, cm.sender_id
        FROM chat_messages cm
        WHERE cm.room_id = cr.id
        ORDER BY cm.created_at DESC
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN users lm_user ON lm_user.id = lm.sender_id
      WHERE cp.user_id = $1
      ORDER BY COALESCE(lm.created_at, cr.created_at) DESC
    `, [userId]);

    const roomIds = rows.rows.map(r => r.room_id);
    if (roomIds.length === 0) return [];

    const participantRows = await pool.query<{ room_id: string; user_id: string; user_name: string; user_role: string }>(`
      SELECT cp.room_id, u.id AS user_id, u.name AS user_name, u.role AS user_role
      FROM chat_participants cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.room_id = ANY($1)
    `, [roomIds]);

    const participantsByRoom: Record<string, { userId: string; name: string; role: string }[]> = {};
    for (const p of participantRows.rows) {
      if (!participantsByRoom[p.room_id]) participantsByRoom[p.room_id] = [];
      participantsByRoom[p.room_id].push({ userId: p.user_id, name: p.user_name, role: p.user_role });
    }

    return rows.rows.map(r => ({
      id: r.room_id,
      type: r.type,
      title: r.title,
      referenceId: r.reference_id,
      status: r.status,
      createdAt: r.room_created_at,
      lastMessage: r.last_message,
      lastMessageAt: r.last_message_at,
      lastSenderName: r.last_sender_name,
      unreadCount: parseInt(r.unread_count),
      participants: participantsByRoom[r.room_id] || [],
    }));
  }

  async getMessages(roomId: string, userId: string, limit = 50, before?: string) {
    await this.assertParticipant(roomId, userId);

    // Q: هل يجب التحقق من قيمة limit قبل إدراجها في نص SQL؟
    // A: نعم — تمرير NaN (ناتج parseInt("abc")) أو قيمة سالبة أو ضخمة جداً
    //    مباشرةً إلى LIMIT ${limit} يُسبب خطأ SQL أو استهلاكاً مفرطاً للذاكرة.
    //    parseInt("abc") = NaN والـ "LIMIT NaN" عبارة SQL غير صالحة تُسبب 500.
    //    الإصلاح: تقييد limit بين 1 و 100 بعد التحقق من أنه رقم صحيح صالح.
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 50;

    let query = `
      SELECT cm.id, cm.room_id, cm.sender_id, cm.content, cm.type, cm.created_at,
             u.name AS sender_name, u.role AS sender_role, u.avatar_url AS sender_avatar
      FROM chat_messages cm
      LEFT JOIN users u ON u.id = cm.sender_id
      WHERE cm.room_id = $1
    `;
    const params: any[] = [roomId];

    if (before) {
      params.push(before);
      query += ` AND cm.created_at < (SELECT created_at FROM chat_messages WHERE id = $${params.length})`;
    }

    query += ` ORDER BY cm.created_at DESC LIMIT ${safeLimit}`;

    const result = await pool.query(query, params);
    return result.rows.reverse().map(r => ({
      id: r.id,
      roomId: r.room_id,
      senderId: r.sender_id,
      content: r.content,
      type: r.type,
      createdAt: r.created_at,
      senderName: r.sender_name ?? "النظام",
      senderRole: r.sender_role ?? "SYSTEM",
      senderAvatar: r.sender_avatar ?? null,
    }));
  }

  async sendMessage(roomId: string, senderId: string, content: string, type: "TEXT" | "SYSTEM" = "TEXT") {
    if (type === "TEXT") await this.assertParticipant(roomId, senderId);

    const [msg] = await db.insert(chatMessages).values({
      roomId,
      senderId: type === "SYSTEM" ? null : senderId,
      content,
      type,
    }).returning();

    // BUG-FIX: Previously always queried the sender by the passed `senderId`, even when
    // type === "SYSTEM" and the DB stores senderId as NULL. This caused system messages to
    // incorrectly return the triggering user's name/role instead of the system identity label.
    if (type === "SYSTEM") {
      return {
        ...msg,
        senderName: "النظام",
        senderRole: "SYSTEM",
        senderAvatar: null,
      };
    }

    const senderInfo = await pool.query<{ name: string; role: string; avatar_url: string | null }>(
      `SELECT name, role, avatar_url FROM users WHERE id = $1`, [senderId]
    );

    return {
      ...msg,
      senderName: senderInfo.rows[0]?.name ?? "النظام",
      senderRole: senderInfo.rows[0]?.role ?? "SYSTEM",
      senderAvatar: senderInfo.rows[0]?.avatar_url ?? null,
    };
  }

  async markRead(roomId: string, userId: string) {
    await pool.query(
      `UPDATE chat_participants SET last_read_at = NOW() WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
  }

  async getRoomParticipants(roomId: string) {
    const result = await pool.query<{ user_id: string; name: string; role: string }>(
      `SELECT u.id AS user_id, u.name, u.role FROM chat_participants cp JOIN users u ON u.id = cp.user_id WHERE cp.room_id = $1`,
      [roomId]
    );
    return result.rows;
  }

  async getTotalUnreadCount(userId: string) {
    const result = await pool.query<{ total: string }>(`
      SELECT COALESCE(SUM(
        (SELECT COUNT(*) FROM chat_messages cm
         WHERE cm.room_id = cp.room_id
         AND (cp.last_read_at IS NULL OR cm.created_at > cp.last_read_at)
         AND cm.sender_id != $1)
      ), 0)::TEXT AS total
      FROM chat_participants cp WHERE cp.user_id = $1
    `, [userId]);
    return parseInt(result.rows[0]?.total ?? "0");
  }

  async findRoomByReference(type: string, referenceId: string) {
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM chat_rooms WHERE type = $1 AND reference_id = $2 LIMIT 1`,
      [type, referenceId]
    );
    return result.rows[0] ?? null;
  }

  async addParticipantIfNotExists(roomId: string, userId: string) {
    await pool.query(`
      INSERT INTO chat_participants (room_id, user_id) VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [roomId, userId]);
  }

  private async assertParticipant(roomId: string, userId: string) {
    const result = await pool.query(
      `SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    if (result.rowCount === 0) throw new Error("NOT_PARTICIPANT");
  }
}

export const chatService = new ChatService();
