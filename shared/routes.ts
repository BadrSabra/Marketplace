import { z } from 'zod';
import { 
  insertUserSchema, users,
  insertStoreSchema, stores,
  insertProductSchema, products,
  insertOrderSchema, orders,
  loginSchema, registerSchema
} from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  unauthorized: z.object({ message: z.string() }),
  forbidden: z.object({ message: z.string() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

// Q: لماذا يستخدم النوع z.custom بدلاً من schema Zod محدد للمستخدم؟
// A: z.custom<T>() هو نوع TypeScript فقط — يُحقق التوافق في وقت الترجمة دون أي
//    تحقق فعلي في وقت التشغيل (runtime). هذا يعني أن أي حقل ناقص أو خاطئ في
//    الاستجابة لن يُسبب خطأ Zod — سيصل الخطأ بشكل صامت كـ undefined.
//    مثال: walletBalance لم يكن في الاستجابة سابقاً → كان يصل كـ undefined دون خطأ.
//    الإصلاح الكامل: استبدال z.custom بـ z.object صريح يتحقق من جميع الحقول في runtime.
//
// ⚠️ خطأ جديد تكشفه هذه الإصلاح:
//    بإضافة walletBalance للاستجابة الفعلية من السيرفر (api/auth/me)، فإن أي
//    مكوّن React يستخدم user.walletBalance سيحصل الآن على القيمة الحقيقية.
//    لكن إذا كان أي مكوّن يتعامل مع user.walletBalance المحسوب من مكان آخر
//    (مثل fetchWallet المستقل)، فقد يظهر تضارب بين قيمتين مختلفتين للرصيد
//    في نفس الصفحة — خطأ كان مخفياً لأن /api/auth/me لم يكن يُعيد walletBalance أبداً.
const userWithoutPassword = z.custom<Omit<typeof users.$inferSelect, "password"> & { walletBalance?: string }>();

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: registerSchema,
      responses: {
        201: z.union([
          z.object({ token: z.string(), user: userWithoutPassword, pendingApproval: z.undefined().optional() }),
          z.object({ pendingApproval: z.literal(true), message: z.string(), user: userWithoutPassword }),
        ]),
        400: errorSchemas.validation,
      }
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: loginSchema,
      responses: {
        200: z.object({ token: z.string(), user: userWithoutPassword }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: userWithoutPassword,
        401: errorSchemas.unauthorized,
      }
    }
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users' as const,
      responses: {
        200: z.array(userWithoutPassword),
        403: errorSchemas.forbidden,
      }
    }
  },
  stores: {
    list: {
      method: 'GET' as const,
      path: '/api/stores' as const,
      responses: { 200: z.array(z.custom<typeof stores.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/stores' as const,
      input: insertStoreSchema,
      responses: {
        201: z.custom<typeof stores.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/stores/:id' as const,
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: z.object({ success: z.boolean(), message: z.string() }),
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
      }
    }
  },
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products' as const,
      responses: { 200: z.array(z.custom<typeof products.$inferSelect>()) }
    }
  },
  orders: {
    list: {
      method: 'GET' as const,
      path: '/api/orders' as const,
      responses: {
        200: z.array(z.custom<typeof orders.$inferSelect>()),
        401: errorSchemas.unauthorized,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}