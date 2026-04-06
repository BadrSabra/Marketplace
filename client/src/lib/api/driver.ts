import { apiFetch } from "../api";
import { DriverTask, Offer, Transaction, Wallet } from "@shared/schema";

// Types based on the requirements
export type DriverTaskExtended = {
  subOrderId: string;
  store: { id: string; name: string; logoUrl?: string };
  items: { productId: string; name: string; qty: number; price: string }[];
  deliveryAddress: string;
  status: "READY" | "ASSIGNED" | "ON_THE_WAY" | "DELIVERED" | "CANCELLED";
  otpId?: string;
  assignedAt?: string;
  estimatedDistance?: number;
};

export type OfferExtended = {
  id: string;
  subOrderId: string;
  store: { id: string; name: string; logoUrl?: string };
  subtotal: string;
  pickupAddress?: string;
  createdAt: string;
};

export async function getDriverTasks(): Promise<DriverTaskExtended[]> {
  const res = await apiFetch("/api/suborders/active");
  return res.json();
}

export async function getAvailableOffers(): Promise<OfferExtended[]> {
  const res = await apiFetch("/api/delivery/offers/available");
  return res.json();
}

export async function placeBid(data: { subOrderId: string; bidAmount: string }) {
  const res = await apiFetch("/api/delivery/offers", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function respondToOffer(id: string, action: "accept" | "reject") {
  const res = await apiFetch(`/api/delivery/offers/${id}/respond`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  return res.json();
}

export async function verifyOtp(otpId: string, otpCode: string) {
  const res = await apiFetch(`/api/delivery/otp/verify/${otpId}`, {
    method: "POST",
    body: JSON.stringify({ otpCode }),
  });
  return res.json();
}

export async function getDriverWallet(): Promise<{ balance: string; currency?: string }> {
  const res = await apiFetch("/api/driver/wallet");
  return res.json();
}

export async function getWalletTransactions(page = 1, limit = 20): Promise<{ transactions: any[]; total: number }> {
  const res = await apiFetch(`/api/driver/wallet/transactions?page=${page}&limit=${limit}`);
  return res.json();
}
