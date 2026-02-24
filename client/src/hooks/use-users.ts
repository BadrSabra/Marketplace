import { useQuery } from "@tanstack/react-query";
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
