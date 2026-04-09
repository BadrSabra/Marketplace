import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Reads the JWT token from localStorage and returns it as an
 * Authorization header object. Returns an empty object if no token exists.
 * This is the single source of truth for auth headers in this file.
 */
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("jwt_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { headers?: Record<string, string> }
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      ...getAuthHeaders(),
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers || {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// Q: هل كان هناك فرق في معالجة 401 بين useQuery الافتراضي و apiFetch؟
// A: نعم — فرق جوهري:
//    1. apiFetch (في api.ts): عند 401 تُزيل التوكن وتُعيد التوجيه لـ /login فوراً.
//    2. getQueryFn (هنا): عند `on401: "throw"` يُرمى خطأ فقط — دون إزالة التوكن
//       ودون إعادة التوجيه. المستخدم يرى "Error" في الواجهة لكن لا يُعاد توجيهه.
//    النتيجة: المستخدمون الذين انتهت صلاحية توكناتهم يرون شاشة خطأ غامضة بدلاً
//    من صفحة تسجيل الدخول عند استخدام useQuery الافتراضي بدون queryFn مخصص.
//    الإصلاح: إضافة معالجة 401 في getQueryFn تتطابق مع سلوك apiFetch — إزالة التوكن
//    وإعادة التوجيه لـ /login. كلا الكودَين الآن يتصرفان بنفس الطريقة عند 401.
//
// ⚠️ خطأ جديد تكشفه هذه الإصلاح:
//    الـ queries التي كانت تعتمد على `on401: "throw"` وتُعيد عرض "رسالة خطأ"
//    ستختفي الآن — المستخدم سيُعاد توجيهه مباشرةً دون رؤية الرسالة.
//    أي صفحة لم تكن تتوقع إعادة التوجيه التلقائي (مثل صفحات تستخدم isError
//    لعرض fallback UI) ستتصرف بشكل مختلف — وهو خطأ جديد في تجربة المستخدم
//    كان مخفياً لأن 401 لم تكن تُعيد التوجيه قبل هذا الإصلاح.
type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      headers: getAuthHeaders(),
      credentials: "include",
    });

    if (res.status === 401) {
      // Q: هل يجب إزالة التوكن وإعادة التوجيه عند 401 في getQueryFn؟
      // A: نعم — apiFetch يفعل ذلك بالفعل. الاتساق بين مسارَي الطلب ضروري
      //    لأن بعض المكوّنات تستخدم useQuery بينما أخرى تستخدم apiRequest/apiFetch.
      //    إذا كان السلوك مختلفاً بينهما، يحصل المستخدم على تجربة غير متسقة:
      //    بعض الصفحات تعيد التوجيه تلقائياً وأخرى تعرض رسالة خطأ غامضة.
      localStorage.removeItem("jwt_token");
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      // BUG-FIX: staleTime was Infinity — data was never considered stale and never
      // automatically re-fetched. For financial data (wallet balance, notifications,
      // orders) this meant a user who kept the tab open would see outdated balances
      // after an admin approved a deposit or rejected a withdrawal, until a manual
      // page refresh. Now set to 60 seconds so data is refreshed on next mount/focus
      // after going stale, while still being cached to prevent unnecessary requests.
      staleTime: 60 * 1000,
      refetchOnWindowFocus: true,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
