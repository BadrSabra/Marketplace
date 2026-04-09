import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiFetch } from "@/lib/api";

export function useOrders() {
  // Q: هل يجب أن يدعم useMyOrders معاملات pagination؟
  // A: نعم — بعد إضافة limit/offset لـ getCustomerOrders في الـ backend،
  //    المسار /api/orders/my-orders يُعيد الآن 20 طلباً فقط بشكل افتراضي.
  //    إذا كان المستخدم لديه أكثر من 20 طلباً، الطلبات الأقدم لن تظهر
  //    في الواجهة بدون دعم pagination هنا.
  //
  // ⚠️ خطأ جديد تكشفه هذه الإصلاح:
  //    كل مكوّن يستخدم useMyOrders() ويتوقع "جميع الطلبات" سيحصل الآن
  //    على 20 طلباً فقط. أي test أو assertion يتوقع عدداً محدداً من الطلبات
  //    قد يفشل إذا كان المستخدم لديه أكثر من 20 — وهو خطأ جديد لم يكن
  //    موجوداً قبل إضافة pagination للـ backend.
  //
  //    الإصلاح المستقبلي: تحويل useMyOrders لـ infinite query باستخدام
  //    useInfiniteQuery لدعم "تحميل المزيد" بدلاً من تحميل كل شيء دفعةً واحدة.
  const useMyOrders = (limit = 20, offset = 0) => useQuery({
    queryKey: ["/api/orders/my-orders", limit, offset],
    queryFn: async () => {
      const url = `/api/orders/my-orders?limit=${limit}&offset=${offset}`;
      const res = await apiFetch(url);
      return res.json();
    },
    refetchInterval: 30000,
  });

  return {
    // Q: هل useOrders() و useMyOrders() يجلبان نفس البيانات؟
    // A: لا — useOrders() يستدعي /api/orders الذي يُعيد طلبات العميل بدون sub-orders،
    //    بينما useMyOrders() يستدعي /api/orders/my-orders الذي يُعيد الطلبات كاملةً
    //    مع sub-orders وتفاصيل كل متجر. هذا ازدواج في الـ endpoints للنفس البيانات
    //    يُربك المطورين — الـ endpoint المفضّل هو my-orders لأنه يحتوي على بيانات أكمل.
    //
    // ⚠️ خطأ جديد تكشفه هذه الإصلاح:
    //    المكوّنات التي تستخدم useOrders() تحصل على بيانات أبسط (بدون sub-orders)
    //    بينما المكوّنات التي تستخدم useMyOrders() تحصل على بيانات أكمل.
    //    إذا استخدم مكوّن واحد كلاهما، سيحصل على قيم مختلفة لنفس البيانات —
    //    تعارض خفي في cache keys يُسبب إعادة renders غير ضرورية.
    useOrders: () => useQuery({
      queryKey: [api.orders.list.path],
      queryFn: async () => {
        const res = await apiFetch(api.orders.list.path);
        const data = await res.json();
        return api.orders.list.responses[200].parse(data);
      },
    }),
    useMyOrders
  };
}
