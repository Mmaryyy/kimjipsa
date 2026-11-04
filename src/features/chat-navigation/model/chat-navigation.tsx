"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountRoutes, chatPath } from "@/shared/config";
import { Toast } from "@/shared/ui";

const historyKey = "kimjipsaChatPanel";
const ChatNavigationContext = createContext({
  ready: false,
  open: false,
  minimized: false,
  onOpen: () => {},
  onClose: () => {},
  onMinimize: () => {},
  onRestoreFocus: () => {},
});

export const useChatNavigation = () => useContext(ChatNavigationContext);

export const ChatNavigationProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [toast, setToast] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const redirecting = useRef(false);
  const closingHistory = useRef(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 기기 설정은 서버 렌더링 뒤에 읽어요.
      setMinimized(localStorage.getItem("kj:botMin") === "1");
    } catch {
      // 저장소를 사용할 수 없으면 이 탭에서만 유지해요.
    }
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === "kj:botMin" || event.key === null) {
        setMinimized(event.newValue === "1");
      }
    };
    const onPopState = () => {
      closingHistory.current = false;
      setOpen(window.history.state?.[historyKey] === true);
    };
    window.addEventListener("storage", sync);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
  const onOpen = useCallback(() => {
    if (closingHistory.current) return;
    opener.current = document.activeElement as HTMLElement | null;
    if (
      window.matchMedia("(max-width: 767px)").matches &&
      !window.history.state?.[historyKey]
    ) {
      window.history.pushState(
        { ...window.history.state, [historyKey]: true },
        "",
        window.location.href,
      );
    }
    setOpen(true);
  }, []);
  useEffect(() => {
    if (pathname === chatPath) {
      redirecting.current = true;
      router.replace(accountRoutes.home);
    } else if (redirecting.current && pathname === accountRoutes.home) {
      redirecting.current = false;
      onOpen();
    }
  }, [pathname, router, onOpen]);
  const onClose = useCallback(() => {
    setOpen(false);
    if (window.history.state?.[historyKey] && !closingHistory.current) {
      closingHistory.current = true;
      window.history.back();
    }
  }, []);
  const onRestoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const target = opener.current?.isConnected
        ? opener.current
        : (document.querySelector<HTMLElement>('[data-od-id="bot-fab"]') ??
          document.querySelector<HTMLElement>('[data-od-id="tab-bot"]') ??
          document.getElementById("main-content"));
      target?.focus({ preventScroll: true });
    });
  }, []);
  const saveMinimized = useCallback((value: boolean) => {
    setMinimized(value);
    try {
      localStorage.setItem("kj:botMin", value ? "1" : "0");
    } catch {
      // 저장소를 사용할 수 없으면 이 탭에서만 유지해요.
    }
  }, []);
  const onMinimize = useCallback(() => {
    saveMinimized(true);
    setToast(true);
    onClose();
  }, [saveMinimized, onClose]);
  const onUndo = useCallback(() => {
    saveMinimized(false);
    setToast(false);
  }, [saveMinimized]);
  return (
    <ChatNavigationContext.Provider
      value={{
        ready,
        open,
        minimized,
        onOpen,
        onClose,
        onMinimize,
        onRestoreFocus,
      }}
    >
      {children}
      <Toast
        open={toast}
        onOpenChange={setToast}
        message="집사를 하단 메뉴로 옮겼어요"
        action={{ label: "되돌리기", onClick: onUndo }}
      />
    </ChatNavigationContext.Provider>
  );
};
