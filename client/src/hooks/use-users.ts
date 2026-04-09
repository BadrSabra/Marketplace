import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiFetch } from "@/lib/api";

export function useUsers() {
  return useQuery({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await apiFetch(api.users.list.path);
      const data = await res.json();
      return api.users.list.responses[200].parse(data);
    },
  });
}

export function useApproveUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiFetch(`/api/admin/users/${userId}/approve`, {
        method: "PATCH",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
    },
  });
}

// Q: لماذا أُضيف useRejectUser منفصلاً عن useApproveUser؟
// A: الرفض يستدعي DELETE /api/admin/users/:id الذي يحذف المستخدم وكل بياناته
//    (المتجر، المحفظة) في transaction واحدة، وهو إجراء مختلف تماماً عن الموافقة
//    التي تستدعي PATCH. الفصل يُوضح النية ويسمح بمعالجة أخطاء مستقلة.
export function useRejectUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      // Q: لماذا حُذف الشرط `if (!res.ok)` هنا، وهل كان يُسبب خطأ إضافياً؟
      // A: نعم — كان هناك خطأ مزدوج:
      //    1. apiFetch() تُرمي تلقائياً عند !res.ok، لذا الشرط كان كوداً ميتاً.
      //    2. لو افترضنا جدلاً أن الشرط وصله التنفيذ، كان يستدعي `res.json()`
      //       داخل الـ if ثم `res.json()` مرة أخرى في return — قراءة مزدوجة
      //       لنفس الـ Response stream تُسبب خطأ "body has already been consumed".
      //    الإصلاح: حذف الشرط الميت والاعتماد على الخطأ المُرمى من apiFetch().
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
    },
  });
}
