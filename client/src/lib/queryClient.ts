import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Reads the JWT token from localStorage and returns it as an
 * Authorization header object. Returns an empty object if no token exists.
 * This is the single source of truth for auth headers in this file.
 */
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("jwt_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { headers?: Record<string, string> }
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      ...getAuthHeaders(),
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers || {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      headers: getAuthHeaders(),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      // BUG-FIX: staleTime was Infinity — data was never considered stale and never
      // automatically re-fetched. For financial data (wallet balance, notifications,
      // orders) this meant a user who kept the tab open would see outdated balances
      // after an admin approved a deposit or rejected a withdrawal, until a manual
      // page refresh. Now set to 60 seconds so data is refreshed on next mount/focus
      // after going stale, while still being cached to prevent unnecessary requests.
      staleTime: 60 * 1000,
      refetchOnWindowFocus: true,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
