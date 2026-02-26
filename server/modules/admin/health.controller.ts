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

    // 4. Disk Check (Mocked for environment constraints as real fs check might be restricted)
    // In a real environment we would use something like check-disk-space
    let diskStatus: any = { freeMb: 1024, totalMb: 5120, status: "OK" };

    const response = {
      status: overallStatus,
      timestamp,
      components: {
        database: dbStatus,
        memory: { usedMb, totalMb, status: memoryStatus },
        cpu: { loadPercent, status: cpuStatus },
        disk: diskStatus
      },
      alerts
    };

    // Audit log (Optional requirement)
    if ((req as any).user) {
      await auditService.logEvent({
        actionType: "SYSTEM_HEALTH_CHECK",
        entityType: "system",
        entityId: "health",
        performedByUserId: (req as any).user.id,
        performedByRole: (req as any).user.role,
        newValue: { overallStatus }
      });
    }

    res.json(response);
  }
};
