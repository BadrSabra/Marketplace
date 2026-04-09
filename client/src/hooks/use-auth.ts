import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiFetch } from "@/lib/api";
import { z } from "zod";

export function useAuth() {
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: user, isLoading, error } = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      if (!localStorage.getItem("jwt_token")) return null;
      
      try {
        const res = await apiFetch(api.auth.me.path);
        const data = await res.json();
        // Zod validation on response
        return api.auth.me.responses[200].parse(data);
      } catch (err) {
        localStorage.removeItem("jwt_token");
        return null;
      }
    },
    retry: false,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      // Q: هل الشرط `if (!res.ok)` ضروري بعد apiFetch()؟
      // A: لا — apiFetch() تُرمي خطأً تلقائياً عند أي استجابة غير ناجحة (!res.ok)،
      //    لذا عند نجاح apiFetch() دون رمي خطأ، يكون res.ok دائماً true.
      //    الإصلاح: حذف الشرط الميت لتوضيح التدفق الفعلي.
      const res = await apiFetch(api.auth.register.path, {
        method: api.auth.register.method,
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      const parsed = api.auth.register.responses[201].parse(resData);

      if (parsed.pendingApproval) {
        return { user: parsed.user, pendingApproval: true, message: (parsed as any).message };
      }

      localStorage.setItem("jwt_token", (parsed as any).token);
      return { user: parsed.user, pendingApproval: false };
    },
    onSuccess: (data) => {
      if (!data.pendingApproval) {
        queryClient.setQueryData([api.auth.me.path], data.user);
      }
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: z.infer<typeof api.auth.login.input>) => {
      const validated = api.auth.login.input.parse(credentials);
      // Q: لماذا حُذف الشرط `if (!res.ok)` هنا؟
      // A: apiFetch() تُرمي خطأً تلقائياً عند أي استجابة غير ناجحة (4xx, 5xx)
      //    مع استخراج رسالة الخطأ من JSON إن وُجدت. الشرط بعدها كان كوداً ميتاً
      //    يُوهم بوجود مسار خطأ إضافي لا يُنفَّذ أبداً.
      const res = await apiFetch(api.auth.login.path, {
        method: api.auth.login.method,
        body: JSON.stringify(validated),
      });
      const data = await res.json();
      const parsed = api.auth.login.responses[200].parse(data);
      
      localStorage.setItem("jwt_token", parsed.token);
      return parsed.user;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], data);
    },
  });

  const logout = () => {
    localStorage.removeItem("jwt_token");
    queryClient.setQueryData([api.auth.me.path], null);
    queryClient.clear();
  };

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    logout,
  };
}
