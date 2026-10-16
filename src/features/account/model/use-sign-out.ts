"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { accountRoutes } from "@/shared/config";
import { signOut } from "../api/api";

export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.clear();
      router.replace(accountRoutes.login);
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
