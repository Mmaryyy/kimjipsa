"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    // 개발 서버의 HMR과 충돌하지 않도록
    // 프로덕션에서만 등록해요.
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        console.error("서비스 워커를 등록하지 못했어요.", error);
      });
  }, []);

  return null;
}
