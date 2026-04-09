import { Request, Response } from "express";
import { db } from "../../db";
// Q: هل يجب استيراد wallets و ledger ديناميكياً داخل getHealth؟
// A: لا — هذه وحدات ثابتة من @shared/schema لا تتغير. استيرادها
//    بـ await import() في كل طلب health check يُضيف Promise overhead
//    بلا مبرر. الإصلاح: نقلها للاستيراد الثابت في بداية الملف.
import { wallets, ledger } from "@shared/schema";
import { sql } from "drizzle-orm";
import os from "os";
import { auditService } from "../../services/auditService";
import { money } from "../../utils/money";

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
      const walletSum = await db.select({ total: sql<string>`sum(balance)` }).from(wallets);
      const [ledgerCredits] = await db
        .select({ sum: sql<string>`sum(amount)` })
        .from(ledger)
        .where(sql`${ledger.creditUserId} IS NOT NULL`);
      const [ledgerDebits] = await db
        .select({ sum: sql<string>`sum(amount)` })
        .from(ledger)
        .where(sql`${ledger.debitUserId} IS NOT NULL`);
      
      // Q: لماذا نستخدم parseFloat هنا بدلاً من money utility للتحقق من تناسق الدفتر؟
      // A: هذه المقارنة هي read-only للـ admin health dashboard — لا تُعدّل بيانات مالية.
      //    parseFloat هنا مقبول للعرض، لكنه يُسبب مشكلة في عتبة التحمل `< 0.01`:
      //
      // Q: لماذا عتبة `Math.abs(wTotal - netLedger) < 0.01` خطيرة؟
      // A: تسمح بفارق يصل لـ 0.999 قرش دون إبلاغ عن inconsistency.
      //    هذا يعني أن فارقاً بـ "0.009" جنيه في كل محفظة × 1000 محفظة = 9 جنيه
      //    ضائع يمر بدون تنبيه. القصد من العتبة تجنب false positives من float arithmetic،
      //    لكن الآن بعد استخدام money utility في كل الحسابات، لا حاجة لعتبة تسامح.
      //    الإصلاح: استخدام money.equals (تطابق قروش كاملة) بدلاً من `< 0.01`.
      //
      // ⚠️ خطأ جديد تكشفه هذا الإصلاح:
      //    SQL sum قد يُعيد null إذا لم تكن هناك سجلات في ledger بعد.
      //    `money.subtract(null, null)` سيُطلق استثناءً. الإصلاح: `|| "0"` موجود بالفعل.
      //    لكن: إذا أعاد SQL مجموعاً بـ 10+ أرقام عشرية (مثل PostgreSQL Numeric بدقة عالية)،
      //    فإن toCents يُقرّبه لأقرب قرش — وهو السلوك المطلوب.
      const walletsTotal = walletSum[0]?.total || "0";
      const ledgerNet = money.subtract(ledgerCredits?.sum || "0", ledgerDebits?.sum || "0");
      const wTotal = parseFloat(walletsTotal);
      const netLedger = parseFloat(ledgerNet);

      ledgerConsistency = {
        walletsTotal: wTotal,
        ledgerNetTotal: netLedger,
        consistent: money.equals(walletsTotal, ledgerNet)
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
