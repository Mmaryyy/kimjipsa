"use client";
import { useCallback, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  type QueryObserver,
} from "@tanstack/react-query";
import { ApiError } from "@/shared/api";
import type { Account } from "@/entities/user";
import { accountRoutes, catalogPath } from "@/shared/config";
import { Toast } from "@/shared/ui";

function isAccountEntry(pathname: string | null) {
  return (
    pathname === accountRoutes.login ||
    pathname === accountRoutes.onboarding ||
    pathname === accountRoutes.terms ||
    pathname === accountRoutes.privacy ||
    pathname === catalogPath ||
    pathname?.startsWith(`${accountRoutes.onboarding}/`) === true
  );
}

function createQueryClient(onSessionExpired: (destination: string) => void) {
  let sessionExpired = false;
  let updatingObservers = false;
  const observers = new Set<QueryObserver>();
  const suspendedOptions = new Map<QueryObserver, QueryObserver["options"]>();
  const suspendObserver = (observer: QueryObserver) => {
    suspendedOptions.set(observer, observer.options);
    observer.setOptions({
      ...observer.options,
      enabled: false,
      refetchInterval: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });
  };
  const suspendQueries = () => {
    updatingObservers = true;
    try {
      for (const observer of observers) suspendObserver(observer);
    } finally {
      updatingObservers = false;
    }
  };
  const resumeQueries = () => {
    sessionExpired = false;
    updatingObservers = true;
    const optionsToRestore = [...suspendedOptions];
    suspendedOptions.clear();
    try {
      for (const [observer, options] of optionsToRestore)
        observer.setOptions(options);
    } finally {
      updatingObservers = false;
    }
  };
  const onError = (error: Error) => {
    if (
      typeof window === "undefined" ||
      !(error instanceof ApiError) ||
      error.status !== 401
    )
      return;
    if (client.isMutating({ mutationKey: ["sign-out"] })) return;
    const { pathname } = window.location;
    if (isAccountEntry(pathname)) return;
    // 계정 조회로 로그인된 적이 확인된 경우에만 만료 안내를 보여 줘요.
    if (!client.getQueryData<Account>(["account"])?.userId) return;
    if (sessionExpired) return;
    sessionExpired = true;
    suspendQueries();
    const inviteToken = pathname.startsWith(`${accountRoutes.invite}/`)
      ? pathname.slice(accountRoutes.invite.length + 1).split("/")[0]
      : null;
    onSessionExpired(
      inviteToken
        ? `${accountRoutes.login}?invite=${inviteToken}`
        : accountRoutes.home,
    );
  };
  const client = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        onError(error);
        if (
          sessionExpired &&
          error instanceof ApiError &&
          error.status === 401 &&
          !isAccountEntry(window.location.pathname) &&
          query.state.data !== undefined
        ) {
          // 만료 때문에 이미 표시한 계정·목록을 오류 화면으로 덮지 않아요.
          client.setQueryData(query.queryKey, query.state.data);
        }
      },
      onSuccess: (data, query) => {
        // 계정 재조회가 성공해 로그인을 확인한 경우에만 만료 억제를 풀어요.
        if (
          query.queryKey.length === 1 &&
          query.queryKey[0] === "account" &&
          (data as Account | undefined)?.userId
        )
          resumeQueries();
      },
    }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        // 새 구독의 자동 조회를 막고, 개별 옵션은 캐시 구독에서도 막아요.
        enabled: () => !sessionExpired,
        refetchOnMount: () => !sessionExpired,
        refetchOnWindowFocus: () => !sessionExpired,
        refetchOnReconnect: () => !sessionExpired,
        refetchInterval: false,
      },
    },
  });
  client.getQueryCache().subscribe((event) => {
    if (event.type === "observerRemoved") {
      observers.delete(event.observer);
      const options = suspendedOptions.get(event.observer);
      suspendedOptions.delete(event.observer);
      if (options) {
        updatingObservers = true;
        try {
          event.observer.setOptions(options);
        } finally {
          updatingObservers = false;
        }
      }
      return;
    }
    if (
      event.type !== "observerAdded" &&
      event.type !== "observerOptionsUpdated"
    )
      return;
    if (event.type === "observerAdded") observers.add(event.observer);
    if (!observers.has(event.observer) || !sessionExpired || updatingObservers)
      return;
    // 다시 렌더하거나 나중에 구독해도 개별 주기 조회가 되살아나지 않아요.
    updatingObservers = true;
    try {
      suspendObserver(event.observer);
    } finally {
      updatingObservers = false;
    }
  });
  return client;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [destination, setDestination] = useState<string | null>(null);
  const [client] = useState(() =>
    createQueryClient((next) => setDestination((current) => current ?? next)),
  );
  const onOpenChange = useCallback((open: boolean) => {
    if (!open) setDestination(null);
  }, []);
  const onGoHome = useCallback(() => {
    // 새 문서에서 만료된 계정 캐시 없이 로그인 여부를 다시 확인해요.
    if (destination) window.location.assign(destination);
  }, [destination]);
  // 로그인·가입 화면으로 넘어가면 기존 안내도 함께 닫아요.
  if (isAccountEntry(pathname) && destination !== null) setDestination(null);
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toast
        open={destination !== null}
        onOpenChange={onOpenChange}
        message="로그인이 풀렸어요. 다시 로그인해 주세요"
        action={{ label: "홈으로 이동", onClick: onGoHome }}
        duration={Infinity}
      />
    </QueryClientProvider>
  );
}
