"use client";
import type { LoginProvider } from "@/entities/user";
import { ApiError } from "@/shared/api";
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
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: accountQueryKey,
    // 공개 화면에 오래 머물러도 이 탭의 로그인 확인 이력을 유지해요.
    gcTime: Infinity,
    queryFn: async () => {
      const previousAccount =
        queryClient.getQueryData<Awaited<ReturnType<typeof fetchAccount>>>(
          accountQueryKey,
        );
      const account = await fetchAccount();
      // 최초 비로그인과 달리, 만료 응답은 마지막 계정 데이터를 덮지 않아요.
      if (previousAccount?.userId && !account.userId)
        throw new ApiError("UNAUTHORIZED", "로그인이 풀렸어요", 401);
      return account;
    },
  });
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
