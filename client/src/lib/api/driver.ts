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
  driver_offer_id?: string | null;
  driver_offer_status?: string | null;
  driver_offered_fee?: string | null;
  driver_counter_offered_fee?: string | null;
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
  try {
    const res = await apiFetch("/api/suborders/active");
    const data = await res.json();
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return [data];
  } catch (err: any) {
    if (err.message?.includes("401") || err.message?.includes("403") || err.message?.includes("Forbidden") || err.message?.includes("Unauthorized")) {
      return [];
    }
    throw err;
  }
}

export async function getAvailableOffers(): Promise<AvailableTask[]> {
  try {
    const res = await apiFetch("/api/delivery/available-tasks");
    const data = await res.json();
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.tasks && Array.isArray(data.tasks)) return data.tasks;
    return [];
  } catch (err: any) {
    if (err.message?.includes("403") || err.message?.includes("Forbidden")) {
      return [];
    }
    throw err;
  }
}

export async function submitOffer(subOrderId: string, proposedFee: number) {
  const res = await apiFetch(`/api/delivery/suborders/${subOrderId}/offer`, {
    method: "POST",
    body: JSON.stringify({ proposedFee }),
  });
  return res.json();
}

export async function acceptCounterOffer(offerId: string) {
  const res = await apiFetch(`/api/delivery/offers/${offerId}/accept-counter`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function acceptTask(subOrderId: string) {
  const res = await apiFetch(`/api/delivery/suborders/${subOrderId}/accept`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function verifyOtp(subOrderId: string, otpCode: string) {
  const res = await apiFetch(`/api/delivery/otp/verify/${subOrderId}`, {
    method: "POST",
    body: JSON.stringify({ otpCode }),
  });
  return res.json();
}

export async function getDriverWallet(): Promise<{ balance: string; currency?: string }> {
  try {
    const res = await apiFetch("/api/wallet");
    return res.json();
  } catch {
    return { balance: "0.00" };
  }
}

export async function getWalletTransactions(page = 1, limit = 20): Promise<{ transactions: any[]; total: number }> {
  try {
    const res = await apiFetch(`/api/ledger/transactions?limit=${limit}&offset=${(page - 1) * limit}`);
    return res.json();
  } catch {
    return { transactions: [], total: 0 };
  }
}
