"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { accountRoutes } from "@/shared/config";
import { signOut } from "../api/api";

export function useSignOut() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: ["sign-out"],
    mutationFn: signOut,
    onMutate: async () => {
      await queryClient.cancelQueries();
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.assign(accountRoutes.login);
    },
  });
  const onSignOut = useCallback(() => mutation.mutate(), [mutation]);

  return {
    onSignOut,
    pending: mutation.isPending,
    error: mutation.isError
      ? "로그아웃하지 못했어요. 다시 시도해 주세요."
      : null,
  };
}
