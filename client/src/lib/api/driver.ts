import { apiFetch } from "../api";

export type AvailableTask = {
  sub_order_id: string;
  order_id: string;
  store_id: string;
  store_name: string;
  customer_name: string;
  customer_address: string;
  items: { product_name: string; quantity: number }[];
  subtotal: number;
  created_at: string;
  status: string;
  assigned_driver_id: string | null;
  driver_offer_status?: string | null;
  driver_offered_fee?: string | null;
};

export type ActiveDelivery = {
  id: string;
  orderId: string;
  status: string;
  subtotal: string;
  customerName: string;
  customerPhone: string;
  items: { productName: string; quantity: number }[];
  storeName?: string;
  hasOtp?: boolean;
};

export async function getDriverTasks(): Promise<ActiveDelivery[]> {
  const res = await apiFetch("/api/suborders/active");
  if (!res.ok) {
    if (res.status === 403 || res.status === 401) return [];
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return [data];
}

export async function getAvailableOffers(): Promise<AvailableTask[]> {
  const res = await apiFetch("/api/delivery/available-tasks");
  if (!res.ok) {
    if (res.status === 403) return [];
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.tasks && Array.isArray(data.tasks)) return data.tasks;
  return [];
}

export async function submitOffer(subOrderId: string, proposedFee: number) {
  const res = await apiFetch(`/api/delivery/suborders/${subOrderId}/offer`, {
    method: "POST",
    body: JSON.stringify({ proposedFee }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function acceptTask(subOrderId: string) {
  const res = await apiFetch(`/api/delivery/suborders/${subOrderId}/accept`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function verifyOtp(subOrderId: string, otpCode: string) {
  const res = await apiFetch(`/api/delivery/otp/verify/${subOrderId}`, {
    method: "POST",
    body: JSON.stringify({ otpCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getDriverWallet(): Promise<{ balance: string; currency?: string }> {
  const res = await apiFetch("/api/wallet");
  if (!res.ok) return { balance: "0.00" };
  return res.json();
}

export async function getWalletTransactions(page = 1, limit = 20): Promise<{ transactions: any[]; total: number }> {
  const res = await apiFetch(`/api/ledger/transactions?limit=${limit}&offset=${(page - 1) * limit}`);
  if (!res.ok) return { transactions: [], total: 0 };
  return res.json();
}
