import { useQuery, useMutation } from "@tanstack/react-query";
import * as driverApi from "../lib/api/driver";
import { queryClient } from "../lib/queryClient";
import { useToast } from "./use-toast";

export function useDriverTasks() {
  return useQuery({
    queryKey: ["/api/suborders/active"],
    queryFn: () => driverApi.getDriverTasks(),
    staleTime: 30_000,
    retry: 1,
    refetchInterval: 30_000,
  });
}

export function useAvailableOffers() {
  return useQuery({
    queryKey: ["/api/delivery/available-tasks"],
    queryFn: () => driverApi.getAvailableOffers(),
    staleTime: 30_000,
    retry: 1,
    refetchInterval: 30_000,
  });
}

export function useSubmitOffer() {
  return useMutation({
    mutationFn: ({ subOrderId, proposedFee }: { subOrderId: string; proposedFee: number }) =>
      driverApi.submitOffer(subOrderId, proposedFee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/available-tasks"] });
    },
  });
}

export function usePlaceOffer() {
  return useSubmitOffer();
}

export function useAcceptCounterOffer() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (offerId: string) => driverApi.acceptCounterOffer(offerId),
    onSuccess: () => {
      toast({ title: "تم قبول العرض المضاد بنجاح", description: "سيتم تحديث حالة الطلب قريبًا." });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/available-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suborders/active"] });
    },
    onError: (error: Error) => {
      toast({ title: "فشل قبول العرض المضاد", description: error.message, variant: "destructive" });
    },
  });
}

export function useVerifyOtp() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ subOrderId, otpCode }: { subOrderId: string; otpCode: string }) =>
      driverApi.verifyOtp(subOrderId, otpCode),
    onSuccess: () => {
      toast({ title: "تم تأكيد التسليم بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/suborders/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/available-tasks"] });
    },
    onError: (error: Error) => {
      toast({ title: "فشل التحقق من OTP", description: error.message, variant: "destructive" });
    },
  });
}


export function useDriverWallet() {
  return useQuery({
    queryKey: ["/api/wallet"],
    queryFn: () => driverApi.getDriverWallet(),
  });
}

export function useWalletTransactions(page = 1) {
  return useQuery({
    queryKey: ["/api/ledger/transactions", page],
    queryFn: () => driverApi.getWalletTransactions(page),
  });
}
