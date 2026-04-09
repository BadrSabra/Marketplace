import { Request, Response, NextFunction } from "express";
import { auditService } from "./audit.service";

export interface AuditRequest extends Request {
  audit?: {
    actionType: string;
    entityType: string;
    entityId: string;
    oldValue?: any;
    metadata?: any;
  };
}

// Q: هل audit.middleware يعمل فعلاً؟ هل يُسجَّل أي حدث من خلاله؟
// A: لا — هذا كود ميت كامل. المنطق مشروط على `req.audit` (السطر 20)،
//    لكن بالبحث في كامل الكودبيس (server/routes.ts وجميع controllers)
//    لا يوجد ولو مسار واحد يُعيِّن `req.audit`. النتيجة:
//    - middleware مُسجَّل كـ app.use() في routes.ts (السطر 42)
//    - يُضيف overhead بتبديل res.send لكل طلب
//    - لكن الجملة الشرطية (if req.audit) لا تتحقق أبداً
//    - لا يُدرَج أي سجل مراجعة من خلاله
//    التسجيل الفعلي يتم مباشرةً في كل وحدة عبر auditService.logEvent()
//    (server/services/auditService.ts). هذا النمط يغني عن الـ middleware تماماً.
//    للإصلاح: إما إزالة auditMiddleware من routes.ts أو استخدامه فعلياً
//    بتعيين req.audit في المسارات المهمة بدلاً من الاستدعاء المباشر.
export function auditMiddleware(req: AuditRequest, res: Response, next: NextFunction) {
  const originalSend = res.send;

  res.send = function (body: any) {
    res.send = originalSend; // Prevent recursion
    
    if (req.method !== "GET" && req.audit) {
      // Fire and forget logging
      auditService.insertAuditLog({
        userId: (req as any).user?.id,
        role: (req as any).user?.role,
        actionType: req.audit.actionType,
        entityType: req.audit.entityType,
        entityId: req.audit.entityId,
        oldValue: req.audit.oldValue,
        newValue: req.body,
        metadata: {
          ...req.audit.metadata,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      }).catch(err => console.error("[AUDIT-MIDDLEWARE-ERROR]", err));
    }
    
    return res.send(body);
  };

  next();
}
