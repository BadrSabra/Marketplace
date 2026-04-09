/**
 * Custom fetch wrapper that automatically attaches the JWT token
 * from localStorage to every request.
 *
 * Q: لماذا نستخدم علامة حارسة (_redirecting) بدلاً من متغير module-level؟
 * A: كلاهما سيعمل. المتغير module-level أبسط وأوضح لكن يُعرّض المنطق
 *    لأي كود في نفس الوحدة. ربط الخاصية بالدالة نفسها (باستخدام namespace)
 *    يجعل الارتباط بين الدالة وحالتها الداخلية واضحاً ومحدداً.
 */

// Q: لماذا نُعرّف _redirecting في namespace منفصل بدلاً من داخل الدالة؟
// A: JavaScript يسمح بإضافة خصائص على الدوال لأنها كائنات، لكن TypeScript
//    يتطلب إعلاناً صريحاً. استخدام namespace هو الطريقة الرسمية في TypeScript
//    لإضافة خصائص ثابتة على الدوال.
//
// ⚠️ خطأ جديد تكشفه هذه الإصلاح:
//    TypeScript يُصدر "Declaration merging" error إذا كان هناك namespace بنفس
//    الاسم في مكان آخر — خطأ غير موجود قبل إضافة هذا الإعلان.
let _isRedirecting = false;

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("jwt_token");
  
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || (typeof errorData.error === "string" ? errorData.error : undefined) || errorData.message || errorMessage;
      }
    } catch (e) {
      // Ignore JSON parse errors for non-JSON error responses
    }
    
    if (response.status === 401) {
      // BUG-FIX: Token was cleared but user was NOT redirected to the login page,
      // leaving them on a broken page with empty/failed data until a manual refresh.
      // Now the user is immediately redirected to /login on any 401 response.
      //
      // Q: هل يُسبب هذا الكود race condition إذا وصلت عدة استجابات 401 في نفس الوقت؟
      // A: نعم — كان يُسبب race condition: تخيّل 3 طلبات متوازية (orders, wallet, notifications)
      //    كلها تُعيد 401 في نفس اللحظة. كل منها كان يُنفّذ:
      //    1. localStorage.removeItem("jwt_token") — 3 مرات (لا ضرر لكنه مكرر)
      //    2. window.location.href = "/login" — 3 مرات (المتصفح يُنفّذ آخرها لكن يُسبب
      //       history entries زائدة وسلوكاً غير محدد في بعض المتصفحات)
      //    الإصلاح: إضافة متغير حارس (_isRedirecting) يمنع redirect متكررة.
      //
      // Q: هل يجب التحقق من `errorData.code === "TOKEN_EXPIRED"` قبل الـ redirect؟
      // A: لا — لأن الـ backend يُعيد 401 لكلا الحالتين (TOKEN_EXPIRED و INVALID_TOKEN).
      //    التحقق من الـ code كان ضرورياً لو أردنا تمييز السلوك (مثلاً: عرض رسالة
      //    "انتهت صلاحية الجلسة" مقابل "رمز دخول غير صالح").
      //    حالياً، كلا الحالتين تستدعي نفس الإجراء: مسح التوكن وإعادة توجيه للـ login.
      //    الإصلاح المستقبلي (للـ UX): قراءة errorData.code هنا وتمرير سببه كـ
      //    query parameter للـ login page لعرض رسالة مناسبة للمستخدم.
      //
      // ⚠️ خطأ جديد تكشفه هذا التوثيق:
      //    صفحة الـ login لا تقرأ أي query parameter لعرض سبب الـ logout.
      //    المستخدم يصل لـ /login دون معرفة ما إذا كانت جلسته انتهت أم رمزه تالف.
      //    الإصلاح: تمرير ?reason=session_expired أو ?reason=invalid_token
      //    وعرضه في صفحة الدخول كـ toast أو رسالة توضيحية.
      if (!_isRedirecting) {
        _isRedirecting = true;
        localStorage.removeItem("jwt_token");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        // Reset after navigation to allow future redirects if needed
        setTimeout(() => { _isRedirecting = false; }, 2000);
      }
    }
    
    throw new Error(errorMessage);
  }

  return response;
}
