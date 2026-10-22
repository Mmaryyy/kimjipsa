"use client";
import { useCallback, useEffect, useState } from "react";
import { enableWebPush, hasWebPushSubscription } from "../api/web-push";

async function readPushStatus() {
  try {
    return {
      subscribed: await hasWebPushSubscription(),
      checking: false,
      failure: "",
    };
  } catch (error) {
    return {
      subscribed: false,
      checking: false,
      failure:
        error instanceof Error
          ? error.message
          : "푸시 구독을 확인하지 못했어요.",
    };
  }
}
export function useWebPush() {
  const [status, setStatus] = useState({
    subscribed: false,
    checking: true,
    failure: "",
  });
  const [pending, setPending] = useState(false);
  const onRetry = useCallback(async () => {
    setStatus((previous) => ({ ...previous, checking: true, failure: "" }));
    setStatus(await readPushStatus());
  }, []);
  useEffect(() => {
    let active = true;
    void readPushStatus().then((result) => {
      if (active) setStatus(result);
    });
    return () => {
      active = false;
    };
  }, []);
  const onConnect = useCallback(async () => {
    setPending(true);
    try {
      await enableWebPush();
      setStatus({ subscribed: true, checking: false, failure: "" });
    } finally {
      setPending(false);
    }
  }, []);
  return { ...status, pending, onRetry, onConnect };
}
