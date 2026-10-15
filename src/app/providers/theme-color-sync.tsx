"use client";

import { useEffect } from "react";

export function ThemeColorSync() {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const color = getComputedStyle(root).getPropertyValue("--bg").trim();
      if (!color) return;
      for (const meta of document.querySelectorAll<HTMLMetaElement>(
        'meta[name="theme-color"]',
      )) {
        meta.content = color;
        // 강제 테마에서도 현재 화면색을 적용해요.
        meta.removeAttribute("media");
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    media.addEventListener("change", sync);
    sync();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
    };
  }, []);

  return null;
}
