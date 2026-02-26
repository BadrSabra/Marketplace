import { db } from "../db";
import { auditLogs, type InsertAuditLog } from "@shared/schema";

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
}

export const auditService = new AuditService();
