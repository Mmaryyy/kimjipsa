"use client";
import {
  botCharacters,
  type BotType,
  type LoginProvider,
} from "@/entities/user";
import { ApiError } from "@/shared/api";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAccount, signIn, updateProfile, updateBotType } from "../api/api";
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
    networkMode: "always",
    // 공개 화면에 오래 머물러도 이 탭의 로그인 확인 이력을 유지해요.
    gcTime: Infinity,
    queryFn: async () => {
      const previousAccount =
        queryClient.getQueryData<Awaited<ReturnType<typeof fetchAccount>>>(
          accountQueryKey,
        );
      let account: Awaited<ReturnType<typeof fetchAccount>>;
      try {
        account = await fetchAccount();
      } catch (error) {
        // Keep the authenticated shell mounted so the cart can show its last list offline.
        // Authentication failures still follow the existing session-expiry path.
        if (
          previousAccount?.userId &&
          error instanceof ApiError &&
          error.code === "network_error"
        )
          return previousAccount;
        throw error;
      }
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

const botTypeStorageKey = "kimjipsa-bot-type";
const getCachedBotType = (): BotType | null => {
  try {
    const value = localStorage.getItem(botTypeStorageKey);
    return value && value in botCharacters ? (value as BotType) : null;
  } catch {
    return null;
  }
};
const getServerBotType = () => null;

// 계정을 받기 전에는 이 기기에서 마지막으로 본 타입을 쓰고, 그것도 없으면 ready=false로 그림을 비워 둔다.
export function useBotCharacter() {
  const account = useAccount();
  const cached = useSyncExternalStore(
    subscribeBrowser,
    getCachedBotType,
    getServerBotType,
  );
  const saved = account.data?.botType;
  useEffect(() => {
    if (!saved) return;
    try {
      localStorage.setItem(botTypeStorageKey, saved);
    } catch {}
  }, [saved]);
  const type = saved ?? cached;
  return {
    ...botCharacters[type ?? "butler"],
    ready: type !== null || !account.isPending,
  };
}
export function useSaveBotType() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateBotType,
    onSuccess: (_, botType: BotType) => {
      client.setQueryData<Awaited<ReturnType<typeof fetchAccount>>>(
        accountQueryKey,
        (account) => (account ? { ...account, botType } : account),
      );
    },
  });
}
