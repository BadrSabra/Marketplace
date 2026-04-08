import { db } from "../db";
import { auditLogs, type InsertAuditLog } from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

export class AuditService {
  async logEvent(params: {
    actionType: string;
    entityType: string;
    entityId: string;
    performedByUserId: string;
    performedByRole: string;
    oldValue?: any;
    newValue?: any;
    metadata?: any;
  }) {
    try {
      const logData: InsertAuditLog = {
        actionType: params.actionType,
        entityType: params.entityType,
        entityId: params.entityId,
        performedByUserId: params.performedByUserId,
        performedByRole: params.performedByRole,
        oldValue: params.oldValue ?? null,
        newValue: params.newValue ?? null,
        metadata: params.metadata ?? null,
      };

      await db.insert(auditLogs).values(logData);
    } catch (error) {
      console.error("Failed to create audit log:", error);
      // Fail silently to not crash the main flow
    }
  }

  async getAuditLogs(filters: {
    userId?: string;
    actionType?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];

    if (filters.userId) {
      conditions.push(eq(auditLogs.performedByUserId, filters.userId));
    }

    if (filters.actionType) {
      conditions.push(eq(auditLogs.actionType, filters.actionType));
    }

    if (filters.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(filters.startDate)));
    }

    if (filters.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(filters.endDate)));
    }

    if (filters.status) {
      conditions.push(eq(sql`metadata->>'status'`, filters.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0);

    const [totalCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause);

    return {
      logs,
      total: Number(totalCount.count)
    };
  }
}

export const auditService = new AuditService();
