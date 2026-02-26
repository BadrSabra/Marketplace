import { db } from "../../db";
import { auditLogs } from "@shared/schema";
import type { AuditLog } from "@shared/schema";

export class AuditService {
  async insertAuditLog(entry: {
    userId?: string;
    role?: string;
    actionType: string;
    entityType: string;
    entityId: string;
    oldValue?: any;
    newValue?: any;
    metadata?: any;
  }) {
    // Redact sensitive data from metadata/values
    const redact = (obj: any): any => {
      if (!obj) return obj;
      const sensitiveFields = ['password', 'token', 'secret', 'credit_card', 'otp'];
      const newObj = { ...obj };
      for (const key in newObj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          newObj[key] = '[REDACTED]';
        } else if (typeof newObj[key] === 'object') {
          newObj[key] = redact(newObj[key]);
        }
      }
      return newObj;
    };

    try {
      const logEntry = {
        performedByUserId: entry.userId || "00000000-0000-0000-0000-000000000000", // System ID
        performedByRole: entry.role || "SYSTEM",
        actionType: entry.actionType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: redact(entry.oldValue),
        newValue: redact(entry.newValue),
        metadata: redact(entry.metadata),
      };

      await db.insert(auditLogs).values(logEntry);
    } catch (error) {
      console.error("[AUDIT-FAILURE]", error);
      // Non-blocking: don't throw
    }
  }
}

export const auditService = new AuditService();
