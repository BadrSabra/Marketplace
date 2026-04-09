// Q: لماذا يوجد هذا الملف منفصلاً عن schema.ts الرئيسي؟
// A: هذا الملف أثر من تصميم قديم حيث كان نظام الإيداع مبنياً على جدول `deposits`
//    مستقل. التصميم الحالي يعتمد على جدول `wallet_transactions` الموجود في schema.ts
//    لتتبع الإيداعات (نوعها: DEPOSIT، وحالتها: PENDING/COMPLETED/FAILED).
//
// Q: هل جدول `deposits` موجود فعلاً في قاعدة البيانات؟
// A: لا — `server/bootstrap/db-auto-verify.ts` لا يُنشئ هذا الجدول.
//    عند تشغيل الخادم، يُنشئ السكريبت 21 جدولاً لكن `deposits` ليس من بينها.
//    أي كود يستورد من هذا الملف ويستدعي استعلامات على `deposits` سيفشل بـ:
//    'ERROR: relation "deposits" does not exist'
//
// Q: هل يجب حذف هذا الملف؟
// A: من الناحية المثالية نعم — لكن الحذف المتسرع يكسر الاستيرادات الموجودة في:
//    - server/modules/deposits/deposits.service.ts (كود ميت لا يُستدعى)
//    - أي ملف مستقبلي قد يستورد منه بالخطأ
//    الإصلاح الآمن: الإبقاء عليه مع توثيق واضح للخطر، ريثما يتم:
//    1. حذف deposits.service.ts (كود ميت)
//    2. حذف هذا الملف في نفس الـ commit
//    ⚠️ لا تستورد `deposits` من هذا الملف في أي كود جديد — استخدم walletTransactions من schema.ts
import { pgTable, uuid, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const deposits = pgTable("deposits", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).notNull().default("PENDING"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
