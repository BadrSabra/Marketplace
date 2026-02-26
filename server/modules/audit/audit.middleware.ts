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
