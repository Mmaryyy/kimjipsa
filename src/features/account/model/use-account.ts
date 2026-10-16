"use client";
import type { LoginProvider } from "@/entities/user";
import { useCallback, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAccount, signIn, updateProfile } from "../api/api";
const subscribeBrowser = () => () => {};
const getKakaoBrowser = () => /KAKAOTALK/i.test(navigator.userAgent);
const getServerBrowser = () => false;
export function useKakaoBrowser() {
  return useSyncExternalStore(
    subscribeBrowser,
    getKakaoBrowser,
    getServerBrowser,
  );
}
const accountQueryKey = ["account"] as const;
export function useAccount() {
  return useQuery({ queryKey: accountQueryKey, queryFn: fetchAccount });
}
export function useSignIn(inviteToken?: string | null) {
  const mutation = useMutation({
    mutationFn: (provider: LoginProvider) => signIn(provider, inviteToken),
  });
  const onKakao = useCallback(() => mutation.mutate("kakao"), [mutation]);
  const onGoogle = useCallback(() => mutation.mutate("google"), [mutation]);
  return {
    pending: mutation.isPending,
    error: mutation.error,
    onKakao,
    onGoogle,
  };
}
export function useProfileForm(onSaved?: () => void) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      onSaved?.();
    },
  });
  return {
    onSubmit: mutation.mutateAsync,
    saved: mutation.isSuccess,
  };
}
