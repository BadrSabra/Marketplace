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
    // Q: لماذا نُعرّف errorCode خارج try block بدلاً من داخله؟
    // A: errorData كانت محلية للـ try block فلا يمكن الوصول إليها عند التحقق من
    //    response.status === 401 لاحقاً. رفعها للنطاق الخارجي يُتيح استخدامها
    //    لتمرير سبب الـ redirect كـ query parameter لصفحة تسجيل الدخول.
    //
    // ⚠️ خطأ جديد تكشفه هذا الإصلاح:
    //    إذا كانت استجابة الـ backend تحتوي على JSON غير متوافق (مثلاً code غائب)،
    //    فإن errorCode سيكون undefined والـ reason سيكون "invalid_token" افتراضياً.
    //    هذا سلوك مقبول — "انتهت الجلسة" أدق من "خطأ غير معروف"، لكن قد يكون
    //    مضللاً إذا كان السبب الحقيقي هو خطأ في الخادم وليس مشكلة في التوكن.
    let errorCode: string | undefined;
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || (typeof errorData.error === "string" ? errorData.error : undefined) || errorData.message || errorMessage;
        errorCode = errorData.code;
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
      // A: نعم — بعد رفع errorData للنطاق الخارجي، يمكننا الآن تمرير سبب دقيق
      //    كـ query parameter لصفحة تسجيل الدخول لعرض رسالة مناسبة للمستخدم.
      //    TOKEN_EXPIRED = جلسة انتهت، INVALID_TOKEN = توكن تالف أو مزيف.
      if (!_isRedirecting) {
        _isRedirecting = true;
        localStorage.removeItem("jwt_token");
        if (window.location.pathname !== "/login") {
          // Q: لماذا نمرر reason كـ query parameter بدلاً من localStorage أو sessionStorage؟
          // A: localStorage يستمر بعد إعادة التحميل — قد يُعرض السبب عدة مرات.
          //    sessionStorage يُفقد عند إغلاق التبويب. query parameter يُقرأ مرة واحدة
          //    ويختفي تلقائياً عند التنقل، وهو النمط الأكثر شيوعاً لهذا الغرض.
          //
          // ⚠️ خطأ جديد تكشفه هذا الإصلاح:
          //    صفحة login.tsx يجب أن تقرأ ?reason وتعرض toast مناسباً.
          //    إذا لم تُحدَّث صفحة تسجيل الدخول، سيصل المستخدم لـ /login?reason=session_expired
          //    دون رؤية أي رسالة توضيحية — وهو الوضع الحالي قبل إصلاح login.tsx.
          const reason = errorCode === "TOKEN_EXPIRED" ? "session_expired" : "invalid_token";
          window.location.href = `/login?reason=${reason}`;
        }
        // Reset after navigation to allow future redirects if needed
        setTimeout(() => { _isRedirecting = false; }, 2000);
      }
    }
    
    throw new Error(errorMessage);
  }

  return response;
}
