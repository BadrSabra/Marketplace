import { auditService } from "./audit.service";
import { db } from "../../db";
import { auditLogs, users } from "@shared/schema";
// Q: هل يجب استيراد sql من drizzle-orm؟
// A: نعم — السطر 31 يستخدم sql`${auditLogs.createdAt} DESC` داخل orderBy لكن sql
//    لم يكن مستورداً، مما يتسبب في ReferenceError عند تشغيل الاختبار. الإصلاح:
//    إضافة sql إلى قائمة الاستيرادات من drizzle-orm.
import { eq, sql } from "drizzle-orm";

async function testAudit() {
  console.log("Starting Audit Infrastructure Tests...");

  try {
    // 1. Test Redaction
    const [admin] = await db.insert(users).values({
      name: "Audit Admin",
      email: `audit-${Date.now()}@test.com`,
      password: "SecretPassword123!",
      role: "ADMIN",
    }).returning();

    await auditService.insertAuditLog({
      userId: admin.id,
      role: "ADMIN",
      actionType: "TEST_REDACTION",
      entityType: "user",
      entityId: admin.id,
      newValue: { password: "SecretPassword123!", token: "abc-123" },
      metadata: { sensitive: { secret_key: "shhh" } }
    });

    const [log] = await db.select()
      .from(auditLogs)
      .where(eq(auditLogs.actionType, "TEST_REDACTION"))
      .orderBy(sql`${auditLogs.createdAt} DESC`)
      .limit(1);

    const newValue = log.newValue as any;
    if (newValue.password === "[REDACTED]" && newValue.token === "[REDACTED]") {
      console.log("PASS: Test 1 - Sensitive data redacted successfully");
    } else {
      console.error("FAIL: Test 1 - Redaction failed", newValue);
    }

    console.log("All Audit tests completed.");
  } catch (error) {
    console.error("Audit test execution failed:", error);
  }
}
