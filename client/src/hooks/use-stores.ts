import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiFetch } from "@/lib/api";
import { z } from "zod";

export function useStores() {
  return useQuery({
    queryKey: [api.stores.list.path],
    queryFn: async () => {
      const res = await apiFetch(api.stores.list.path);
      const data = await res.json();
      // Date parsing workaround if schema expects Date objects but JSON provides strings
      return api.stores.list.responses[200].parse(data);
    },
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (storeData: z.infer<typeof api.stores.create.input>) => {
      const validated = api.stores.create.input.parse(storeData);
      const res = await apiFetch(api.stores.create.path, {
        method: api.stores.create.method,
        body: JSON.stringify(validated),
      });
      const data = await res.json();
      return api.stores.create.responses[201].parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
    },
  });
}

export function useDeleteStore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/stores/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete store");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stores.list.path] });
    },
  });
}
