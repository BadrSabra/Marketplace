import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiFetch } from "@/lib/api";

export function useOrders() {
  const useMyOrders = () => useQuery({
    queryKey: ["/api/orders/my-orders"],
    queryFn: async () => {
      const res = await apiFetch("/api/orders/my-orders");
      return res.json();
    },
    refetchInterval: 30000,
  });

  return {
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
