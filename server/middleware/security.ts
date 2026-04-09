import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

export const securityMiddleware = [
  (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      // Q: هل يجب إبقاء 'unsafe-inline' و'unsafe-eval' في سياسة CSP للإنتاج؟
      // A: لا — هذا خطأ أمني فادح:
      //    • 'unsafe-eval' يسمح بتنفيذ eval() وdynamicScript() وما شابه،
      //      مما يُبطل الحماية الأساسية من هجمات XSS بالكامل.
      //    • 'unsafe-inline' للسكريبت يسمح بتشغيل أي سكريبت مضمّن في HTML،
      //      وهو نمط الهجوم الرئيسي لـ XSS.
      //    تطبيق Vite في وضع الإنتاج يُخرج حزم JS مُجمَّعة كملفات ثابتة مُعشَّشة
      //    (hashed bundles) لا تحتاج 'unsafe-eval' أو 'unsafe-inline'.
      //    React نفسه لا يستخدم eval() في الإنتاج.
      //    الإصلاح: حذف 'unsafe-eval' من script-src بالكامل.
      //    'unsafe-inline' تُبقى في style-src فقط لأن Tailwind وRadix UI
      //    يُنشئان أحياناً styles مضمَّنة (inline styles) في HTML.
      res.setHeader("Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https:; " +
        "connect-src 'self' wss: ws: https:; " +
        "font-src 'self' data:; " +
        "worker-src 'self' blob:;"
      );
    }
    next();
  }
];

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Increased for development/resource loading
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many requests from this IP" } },
  skip: (req) => {
    // Skip rate limiting for static assets and vite HMR
    return req.path.includes('/@vite/') || 
           req.path.includes('/@fs/') || 
           req.path.includes('/src/') ||
           req.path.endsWith('.js') ||
           req.path.endsWith('.css') ||
           req.path.endsWith('.ts');
  }
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: { code: "LOGIN_ATTEMPTS_EXCEEDED", message: "Too many login attempts. Try again later." } }
});

export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { success: false, error: { code: "OTP_VERIFY_ATTEMPTS_EXCEEDED", message: "Too many verification attempts. Try again later." } }
});

export const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { success: false, error: { code: "ORDER_LIMIT_EXCEEDED", message: "Too many orders. Try again later." } }
});

export const depositLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: { code: "DEPOSIT_LIMIT_EXCEEDED", message: "Too many deposit attempts. Try again later." } }
});

// Q: لماذا يحتاج register endpoint لحد معدل طلبات منفصل؟
// A: بدون حد، يمكن لمهاجم إنشاء آلاف الحسابات تلقائياً بـ bot:
//    1. تضخيم قاعدة بيانات المستخدمين (storage DoS)
//    2. استغلال أي مكافأة تسجيل (bonus abuse)
//    3. إنشاء حسابات مزيفة للتلاعب بنظام التقييمات
//    الإصلاح: 10 تسجيلات/ساعة — كافٍ للمستخدم الحقيقي (يسجّل مرة أو مرتين)
//    ومقيّد بما يكفي لمنع الأتمتة الجماعية.
//
// Q: هل يجب تعطيل registerLimiter في بيئة التطوير؟
// A: نعم — في بيئة التطوير، اختبار متعدد الحسابات (10+ حسابات في ساعة) سيُعيد 429
//    وهو سلوك مزعج يُعرقل الاختبار اليدوي والتطوير. القيد ضروري فقط في الإنتاج.
//    الإصلاح: إضافة skip للـ NODE_ENV=development.
//
// ⚠️ خطأ جديد تكشفه هذا الإصلاح:
//    express-rate-limit يستخدم IP المصدر للتتبع. في بيئة Replit الإنتاجية،
//    الطلبات قد تصل عبر proxy مشترك — قد يتأثر مستخدمون شرعيون يشتركون بنفس IP.
//    تم معالجة ذلك مسبقاً بـ `app.set("trust proxy", 1)` في server/index.ts.
//
// ⚠️ خطأ جديد تكشفه إضافة skip للـ development:
//    أي بيئة تُعيّن NODE_ENV=development ستكون بدون حماية تسجيل تماماً.
//    إذا نُشر الكود عن طريق الخطأ بـ NODE_ENV=development في production،
//    ستصبح نقطة التسجيل مكشوفة بالكامل. الإصلاح الوقائي: التحقق من NODE_ENV
//    في startup script وإيقاف الخادم إذا لم يكن "production" أو "development" فقط.
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  // Q: هل skip يُطبَّق قبل max أم بعده؟
  // A: skip يُطبَّق أولاً — إذا أعادت الدالة true، يُتجاوز كل منطق rate-limit
  //    بالكامل بما فيه حساب العداد. لا ضرر من هذا لأن dev البيئة لا تُنشر.
  skip: () => process.env.NODE_ENV === "development",
  message: { success: false, error: { code: "REGISTER_LIMIT_EXCEEDED", message: "Too many registration attempts. Try again later." } }
});

// Q: لماذا يحتاج withdraw endpoint لحد معدل طلبات منفصل؟
// A: طلبات السحب تستدعي تدخلاً بشرياً (admin approval) وتُرسل إشعارات.
//    بدون حد: مستخدم غاضب أو bot يُرسل 1000 طلب سحب في دقيقة →
//    1. فيضان إشعارات للأدمن (notification DoS)
//    2. فيضان جدول withdrawal_requests بسجلات وهمية
//    3. إشغال موارد DB بـ FOR UPDATE locks المتزامنة
//    الإصلاح: 5 طلبات/24 ساعة — المستخدم الحقيقي نادراً ما يسحب أكثر من مرة يومياً.
export const withdrawLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  message: { success: false, error: { code: "WITHDRAW_LIMIT_EXCEEDED", message: "Too many withdrawal requests. Try again later." } }
});

export const payloadSizeLimit = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 10 * 1024 * 1024) { // 10MB
    return res.status(413).json({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request payload exceeds 10MB limit" }
    });
  }
  next();
};
