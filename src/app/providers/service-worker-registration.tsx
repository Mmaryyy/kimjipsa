"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function ServiceWorkerRegistration() {
  const client = useQueryClient();
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const onControlled = () => {
      void client
        .invalidateQueries({ queryKey: ["account"] })
        .then(() =>
          Promise.all([
            client.invalidateQueries({ queryKey: ["cart"] }),
            client.invalidateQueries({ queryKey: ["inventory-meta"] }),
          ]),
        );
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControlled);

    // 개발 서버의 HMR과 충돌하지 않도록
    // 프로덕션에서만 등록해요.
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        console.error("서비스 워커를 등록하지 못했어요.", error);
      });
    return () =>
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControlled,
      );
  }, [client]);

  return null;
}
