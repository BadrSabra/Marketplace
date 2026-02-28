import { useQuery, useMutation } from "@tanstack/react-query";
import * as driverApi from "../lib/api/driver";
import { queryClient } from "../lib/queryClient";
import { useToast } from "./use-toast";

export function useDriverTasks() {
  return useQuery({
    queryKey: ["/api/driver/tasks"],
    queryFn: async () => {
      const data = await driverApi.getDriverTasks();
      console.log("DRIVER_TASKS_FETCH: success, count =", data.length);
      return data;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useAvailableOffers() {
  return useQuery({
    queryKey: ["/api/delivery/offers/available"],
    queryFn: async () => {
      const data = await driverApi.getAvailableOffers();
      console.log("AVAILABLE_OFFERS_FETCH: success, count =", data.length);
      return data;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function usePlaceOffer() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: driverApi.placeBid,
    onSuccess: () => {
      toast({ title: "Bid placed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/offers/available"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to place bid", description: error.message, variant: "destructive" });
    },
  });
}

export function useVerifyOtp() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ otpId, otpCode }: { otpId: string; otpCode: string }) => 
      driverApi.verifyOtp(otpId, otpCode),
    onSuccess: () => {
      toast({ title: "Delivery confirmed" });
      queryClient.invalidateQueries({ queryKey: ["/api/driver/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/offers/available"] });
    },
    onError: (error: Error) => {
      toast({ title: "OTP verification failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useDriverWallet() {
  return useQuery({
    queryKey: ["/api/driver/wallet"],
    queryFn: async () => {
      const data = await driverApi.getDriverWallet();
      console.log("DRIVER_WALLET_FETCH: success, balance =", data.balance);
      return data;
    },
  });
}

export function useWalletTransactions(page = 1) {
  return useQuery({
    queryKey: ["/api/driver/wallet/transactions", page],
    queryFn: async () => {
      const data = await driverApi.getWalletTransactions(page);
      console.log("TRANSACTIONS_FETCHED: total =", data.total);
      return data;
    },
  });
}
