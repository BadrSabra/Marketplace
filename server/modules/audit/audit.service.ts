import { db } from "../../db";
import { auditLogs } from "@shared/schema";
import type { AuditLog } from "@shared/schema";

// Q: لماذا توجد خدمتا AuditService في المشروع وأيهما يجب استخدامها؟
// A: المشروع يحتوي على خدمتين مختلفتين لتسجيل أحداث المراجعة:
//    1) هذه الخدمة (server/modules/audit/audit.service.ts) — تُستخدم من قِبَل
//       audit.middleware.ts ولديها UUID احتياطي "00000000-0000-0000-0000-000000000000"
//       عندما يكون userId غير معروف. إذا لم يكن هذا UUID موجوداً في جدول users،
//       ستفشل عملية الإدراج بـ FK violation لكنها تُبلَع بصمت بواسطة try/catch.
//    2) server/services/auditService.ts — تُستخدم من باقي الوحدات (orders, wallet,
//       deposits, products). تطلب performedByUserId صريحاً دون fallback.
//    السبب الجذري: نمت قاعدة الكود بمرور الوقت وأُنشئت الخدمة الثانية بدون توحيدهما.
//    في الوقت الحالي الخطأ غير مؤثر (middleware لا تُطلَق إلا على مسارات محمية بمصادقة
//    حيث userId دائماً متوفر) لكن يُوصى بتوحيدهما في المستقبل.
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
