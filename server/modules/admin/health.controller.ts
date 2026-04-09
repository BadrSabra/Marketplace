import { Request, Response } from "express";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import os from "os";
import { auditService } from "../../services/auditService";

export const healthController = {
  getHealth: async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    const alerts: string[] = [];
    let overallStatus: "OK" | "DEGRADED" | "DOWN" = "OK";

    // 1. Database Check
    let dbStatus: any = { status: "OK", responseTimeMs: 0 };
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      dbStatus.responseTimeMs = Date.now() - start;
    } catch (err: any) {
      dbStatus.status = "DOWN";
      dbStatus.error = err.message;
      alerts.push(`Database is unreachable: ${err.message}`);
      overallStatus = "DOWN";
    }

    // 2. Memory Check
    const memoryUsage = process.memoryUsage();
    const usedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const totalMb = Math.round(os.totalmem() / 1024 / 1024);
    let memoryStatus: "OK" | "WARN" | "CRITICAL" = "OK";
    
    // Thresholds: WARN > 80% of heap, CRITICAL > 95%
    // Simplified for this environment:
    if (usedMb > 1024) memoryStatus = "WARN";
    if (usedMb > 1536) memoryStatus = "CRITICAL";

    if (memoryStatus !== "OK") {
      alerts.push(`High memory usage: ${usedMb}MB`);
      if (overallStatus !== "DOWN") overallStatus = "DEGRADED";
      if (memoryStatus === "CRITICAL") overallStatus = "DOWN";
    }

    // 3. CPU Check
    const cpus = os.cpus();
    const loadAvg = os.loadavg()[0]; // 1 min load avg
    const loadPercent = Math.min(Math.round((loadAvg / cpus.length) * 100), 100);
    let cpuStatus: "OK" | "WARN" | "CRITICAL" = "OK";
    
    if (loadPercent > 80) cpuStatus = "WARN";
    if (loadPercent > 95) cpuStatus = "CRITICAL";

    if (cpuStatus !== "OK") {
      alerts.push(`High CPU load: ${loadPercent}%`);
      if (overallStatus !== "DOWN") overallStatus = "DEGRADED";
      if (cpuStatus === "CRITICAL") overallStatus = "DOWN";
    }

    // 4. Ledger Consistency Check
    // Q: هل المقارنة الصحيحة هي sum(wallet.balance) مقابل sum(ledger.amount)؟
    // A: لا — هذا خطأ رياضي. دفتر الأستاذ يحتوي على مدخلات دائن ومدين معاً.
    //    جمع كل المبالغ (credits + debits) يُعطي قيمة أكبر دائماً من رصيد المحفظة
    //    لأن كل عملية دفع تُسجَّل مرتين (مدين للعميل + دائن للمتجر/السائق).
    //    الصواب: (مجموع الدائن - مجموع المدين) يجب أن يُساوي مجموع أرصدة المحافظ.
    //    الإصلاح: استخدام استعلامين منفصلين (credit فقط، debit فقط) واحتساب الصافي.
    let ledgerConsistency: any = { consistent: true };
    try {
      const { wallets, ledger } = await import("@shared/schema");
      const walletSum = await db.select({ total: sql<string>`sum(balance)` }).from(wallets);
      const [ledgerCredits] = await db
        .select({ sum: sql<string>`sum(amount)` })
        .from(ledger)
        .where(sql`${ledger.creditUserId} IS NOT NULL`);
      const [ledgerDebits] = await db
        .select({ sum: sql<string>`sum(amount)` })
        .from(ledger)
        .where(sql`${ledger.debitUserId} IS NOT NULL`);
      
      const wTotal = parseFloat(walletSum[0]?.total || "0");
      const netLedger = parseFloat(ledgerCredits?.sum || "0") - parseFloat(ledgerDebits?.sum || "0");
      
      ledgerConsistency = {
        walletsTotal: wTotal,
        ledgerNetTotal: netLedger,
        consistent: Math.abs(wTotal - netLedger) < 0.01
      };

      if (!ledgerConsistency.consistent) {
        overallStatus = "DEGRADED";
        alerts.push("Ledger inconsistency detected");
      }
    } catch (err: any) {
      ledgerConsistency = { status: "ERROR", error: err.message };
    }

    // 5. Backup Verification
    let backupStatus: any = { status: "OK" };
    try {
      const fs = await import("fs");
      const path = await import("path");
      const backupsDir = path.join(process.cwd(), "backups");
      if (fs.existsSync(backupsDir)) {
        const files = fs.readdirSync(backupsDir).filter(f => f.endsWith(".sql")).sort().reverse();
        if (files.length > 0) {
          const stats = fs.statSync(path.join(backupsDir, files[0]));
          backupStatus = {
            filename: files[0],
            size: stats.size,
            timestamp: stats.mtime,
            valid: stats.size > 0
          };
          if (stats.size === 0) {
            backupStatus.status = "ERROR";
            alerts.push("Latest backup is empty");
          }
        } else {
          backupStatus = { status: "MISSING" };
          alerts.push("No backups found");
        }
      } else {
        backupStatus = { status: "NO_DIRECTORY" };
      }
    } catch (err: any) {
      backupStatus = { status: "ERROR", error: err.message };
    }

    const response = {
      status: overallStatus,
      ok: overallStatus === "OK",
      timestamp,
      components: {
        database: dbStatus,
        memory: { usedMb, totalMb, status: memoryStatus },
        cpu: { loadPercent, status: cpuStatus },
        ledger: ledgerConsistency,
        backup: backupStatus
      },
      alerts
    };

    // Audit log (Optional requirement)
    // BUG-FIX: entityId was the string "health" which is not a valid UUID.
    // The audit_logs.entity_id column is defined as UUID, so inserting "health" would
    // cause a PostgreSQL type error and throw an exception on every health check call.
    // Now uses the requesting admin's user ID as the entity being audited.
    if ((req as any).user) {
      await auditService.logEvent({
        actionType: "SYSTEM_HEALTH_CHECK",
        entityType: "system",
        entityId: (req as any).user.id,
        performedByUserId: (req as any).user.id,
        performedByRole: (req as any).user.role,
        newValue: { overallStatus }
      });
    }

    res.json(response);
  }
};
