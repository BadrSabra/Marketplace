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

  const loginMutation = useMutation({
    mutationFn: async (credentials: z.infer<typeof api.auth.login.input>) => {
      const validated = api.auth.login.input.parse(credentials);
      const res = await apiFetch(api.auth.login.path, {
        method: api.auth.login.method,
        body: JSON.stringify(validated),
      });
      const data = await res.json();
      const parsed = api.auth.login.responses[200].parse(data);
      
      // Store token
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
    logout,
  };
}
