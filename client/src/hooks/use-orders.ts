import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiFetch } from "@/lib/api";

export function useOrders() {
  return useQuery({
    queryKey: [api.orders.list.path],
    queryFn: async () => {
      const res = await apiFetch(api.orders.list.path);
      const data = await res.json();
      return api.orders.list.responses[200].parse(data);
    },
  });
}
