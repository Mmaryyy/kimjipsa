"use client";
import { useCallback, useEffect, useState } from "react";
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export function useInstallGuide() {
  const [platform, setPlatform] = useState<
    "ios" | "other" | "installed" | null
  >(null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () => {
      const navigatorWithStandalone = navigator as Navigator & {
        standalone?: boolean;
      };
      const installed = media.matches || navigatorWithStandalone.standalone;
      const ios =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setPlatform(installed ? "installed" : ios ? "ios" : "other");
    };
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installed = () => {
      setPlatform("installed");
      setPrompt(null);
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  const onInstall = useCallback(async () => {
    if (!prompt) return;
    setPending(true);
    setError("");
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } catch {
      setError(
        "설치 화면을 열지 못했어요. 브라우저 메뉴에서 홈 화면에 추가해 주세요.",
      );
    } finally {
      setPending(false);
    }
  }, [prompt]);
  return { platform, canPrompt: prompt !== null, onInstall, pending, error };
}
