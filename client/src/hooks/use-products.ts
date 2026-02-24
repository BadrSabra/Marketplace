import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiFetch } from "@/lib/api";

export function useProducts() {
  return useQuery({
    queryKey: [api.products.list.path],
    queryFn: async () => {
      const res = await apiFetch(api.products.list.path);
      const data = await res.json();
      return api.products.list.responses[200].parse(data);
    },
  });
}
