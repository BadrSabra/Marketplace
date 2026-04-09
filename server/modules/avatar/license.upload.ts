import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Request } from "express";

// Q: لماذا نحتاج لـ multer مستقل لرفع رخصة القيادة بدلاً من إعادة استخدام avatarUpload؟
// A: استخدام avatarUpload لرفع الرخص يُسبب ثلاث مشكلات:
//    1. تُحفظ ملفات الرخص في /uploads/avatars/ — يختلط محتوى مختلف في مجلد واحد،
//       مما يُصعّب إدارة التخزين أو تطبيق سياسات حذف مستقلة لكل نوع.
//    2. عنوان URL المُخزَّن في DB يشير لـ /uploads/avatars/ — مما يُصعّب على الأدمن
//       تمييز صور الرخص عن الصور الشخصية برمجياً (مثلاً في لوحة المراجعة).
//    3. مخاطر أمنية: لو أُضيف في المستقبل middleware يُقيّد الوصول لـ /uploads/avatars
//       بناءً على أصحابها، ستظهر الرخص كصور عادية وتُطبَّق عليها نفس القيود.
//    الإصلاح: إنشاء multer مستقل يُخزَّن في /uploads/licenses/ بنفس إعدادات الحماية.
//
// ⚠️ خطأ جديد تكشفه هذا الإصلاح:
//    الرخص القديمة المُخزَّنة في DB بمسار /uploads/avatars/... ستظل صحيحة وتعمل.
//    لكن إذا حاول النظام مستقبلاً المقارنة بين مسارات الرخص والصور الشخصية
//    (مثلاً: WHERE drivers_license_url LIKE '/uploads/licenses/%') فلن يجد
//    الرخص القديمة المحفوظة في /uploads/avatars/. يجب تشغيل migration script
//    لتحديث المسارات القديمة عند نشر هذا الإصلاح للإنتاج.

const licenseUploadDir = path.resolve("uploads/licenses");
if (!fs.existsSync(licenseUploadDir)) {
  fs.mkdirSync(licenseUploadDir, { recursive: true });
}

const licenseStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, licenseUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const licenseFileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/pdf"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("نوع الملف غير مدعوم. يُسمح بـ JPG, PNG, WEBP, PDF فقط"));
  }
};

export const licenseUpload = multer({
  storage: licenseStorage,
  fileFilter: licenseFileFilter,
  // Q: لماذا 10MB بدلاً من 5MB كما في avatarUpload؟
  // A: رخصة القيادة قد تكون مسحاً ضوئياً بجودة عالية أو ملف PDF يتجاوز 5MB بسهولة.
  //    رفع الصور الشخصية (avatars) يتطلب صور بحجم أصغر، لكن وثائق الهوية الرسمية
  //    غالباً ما تكون أكبر حجماً لضمان وضوح البيانات عند المراجعة.
  limits: { fileSize: 10 * 1024 * 1024 },
});
