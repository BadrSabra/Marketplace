import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { roleEnum } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. The server cannot start without it.");
}

export type UserRole = (typeof roleEnum.enumValues)[number];

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as any;
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    // Q: هل يجب التمييز بين التوكن المنتهي الصلاحية والتوكن المزيف/المعطوب؟
    // A: نعم — jwt.verify يُطلق TokenExpiredError (اسم الخطأ = "TokenExpiredError")
    //    عندما يكون التوكن صالحاً تقنياً لكن انتهت مدة صلاحيته، و JsonWebTokenError
    //    لأي خطأ آخر (توقيع خاطئ، بنية غير صالحة). الفرق مهم للواجهة الأمامية:
    //    - TOKEN_EXPIRED: يجب توجيه المستخدم لصفحة تسجيل الدخول فقط (جلسة انتهت)
    //    - INVALID_TOKEN: قد يشير لمحاولة اختراق أو تلاعب بالتوكن (يستحق تسجيلاً)
    //    الكود السابق كان يُعيد "Invalid token" في كلتا الحالتين — الواجهة لا تعرف
    //    إن كان المستخدم بحاجة لتجديد الجلسة أم حدث شيء أسوأ.
    //    الإصلاح: إضافة حقل code في الاستجابة يُمكّن الواجهة من التمييز.
    //
    // ⚠️ خطأ جديد تكشفه هذه الإصلاح:
    //    الواجهة الأمامية التي تتحقق بـ `response.data.message === "Invalid token"`
    //    لتوجيه المستخدم لصفحة تسجيل الدخول، لن تشغّل هذا التوجيه عند انتهاء
    //    الصلاحية بعد الآن (لأن الرسالة أصبحت "انتهت صلاحية الجلسة").
    //    الإصلاح على الواجهة: التحقق بـ `response.status === 401` بدلاً من المحتوى،
    //    أو التحقق من `response.data.code === "TOKEN_EXPIRED"` لعرض رسالة مناسبة.
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً",
        code: "TOKEN_EXPIRED",
      });
    }
    return res.status(401).json({ message: "Invalid token", code: "INVALID_TOKEN" });
  }
}

export function authorizeRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });
    }
    next();
  };
}
