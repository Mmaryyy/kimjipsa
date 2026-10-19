"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountRoutes, invitePath } from "@/shared/config";
import {
  fetchFamily,
  createFamily,
  createInvite,
  fetchInvite,
  acceptInvite,
} from "../api/api";
const familyQueryKey = ["family"] as const;
export function useFamily() {
  return useQuery({ queryKey: familyQueryKey, queryFn: fetchFamily });
}
export function useInvite(token: string) {
  return useQuery({
    queryKey: ["invite", token],
    queryFn: () => fetchInvite(token),
  });
}
export function useCreateFamily(onCreated?: () => void) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createFamily,
    onSuccess: async () => {
      onCreated?.();
      await queryClient.invalidateQueries();
      if (!onCreated) router.replace(accountRoutes.family);
    },
  });
  return { onSubmit: mutation.mutateAsync };
}
export function useAcceptInvite(token: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => acceptInvite(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      await queryClient.invalidateQueries({ queryKey: familyQueryKey });
      router.replace(accountRoutes.home);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["invite", token] });
    },
  });
  const onAccept = useCallback(() => mutation.mutate(), [mutation]);
  return {
    onAccept,
    pending: mutation.isPending || mutation.isSuccess,
    error: mutation.error,
  };
}
export function useInviteShare() {
  const [shareMessage, setShareMessage] = useState("");
  const mutation = useMutation({
    mutationFn: createInvite,
    onMutate: () => setShareMessage(""),
  });
  const onCreate = useCallback(() => mutation.mutate(), [mutation]);
  const onShare = useCallback(
    async (copyOnly = false) => {
      if (!mutation.data) return;
      const url = new URL(
        invitePath(mutation.data.token),
        window.location.origin,
      ).toString();
      try {
        if (!copyOnly && navigator.share)
          await navigator.share({ title: "우리 집에 초대해요", url });
        else {
          await navigator.clipboard.writeText(url);
          setShareMessage("초대 링크를 복사했어요.");
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setShareMessage(
          "공유하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요.",
        );
      }
    },
    [mutation.data],
  );
  return {
    onCreate,
    onShare,
    invitation: mutation.data,
    pending: mutation.isPending,
    error: mutation.error,
    shareMessage,
  };
}
