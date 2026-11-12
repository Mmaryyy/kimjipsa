"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { withdrawAccount } from "@/features/account";
import { accountRoutes } from "@/shared/config";

export function useWithdrawAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: withdrawAccount,
    onSuccess: () => {
      queryClient.clear();
      router.replace(accountRoutes.login);
    },
  });
  const onWithdraw = useCallback(() => mutation.mutateAsync(), [mutation]);

  return {
    onWithdraw,
    pending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
