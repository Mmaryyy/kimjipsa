"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ConfirmContext,
  ConfirmOpenContext,
  type Confirm,
  type ConfirmOptions,
} from "../confirm-context";
import { ConfirmDialog } from "../confirm-dialog";

type Request = {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
  opener: HTMLElement | null;
};

export function ConfirmHost({
  children,
  scope,
}: {
  children: ReactNode;
  scope?: string | null;
}) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const running = useRef<Request | null>(null);
  const request = requests[0];
  const requestsRef = useRef(requests);
  useEffect(() => {
    return () => {
      requestsRef.current.forEach(({ resolve }) => resolve(false));
      requestsRef.current = [];
      running.current = null;
      setPending(false);
      setRequests([]);
      setError("");
    };
  }, [scope]);
  const isOpen = useCallback(() => requestsRef.current.length > 0, []);
  const confirm: Confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        const opener =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        requestsRef.current = [
          ...requestsRef.current,
          { options, resolve, opener },
        ];
        setRequests(requestsRef.current);
      }),
    [],
  );
  const finish = (confirmed: boolean) => {
    if (requestsRef.current[0] !== request) return;
    request.resolve(confirmed);
    requestsRef.current = requestsRef.current.slice(1);
    setRequests(requestsRef.current);
    setError("");
  };
  const run = async (
    action: ConfirmOptions["onConfirm"],
    confirmed: boolean,
  ) => {
    if (running.current || requestsRef.current[0] !== request) return;
    running.current = request;
    setPending(true);
    setError("");
    try {
      if (request.options.disabled?.())
        throw new Error(
          "지금은 실행할 수 없어요. 연결이나 진행 중인 작업을 확인해 주세요.",
        );
      await action?.();
      finish(confirmed);
    } catch (reason) {
      if (requestsRef.current[0] !== request) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "처리하지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      if (running.current === request) {
        running.current = null;
        setPending(false);
      }
    }
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      <ConfirmOpenContext.Provider value={isOpen}>
        {children}
      </ConfirmOpenContext.Provider>
      {request && (
        <ConfirmDialog
          {...request.options}
          open
          pending={pending}
          onOpenChange={(open) => {
            if (!open && !running.current) finish(false);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (request.opener?.isConnected) request.opener.focus();
          }}
          onConfirm={() => void run(request.options.onConfirm, true)}
          secondaryAction={
            request.options.secondaryAction && {
              label: request.options.secondaryAction.label,
              onClick: () =>
                void run(request.options.secondaryAction?.onClick, false),
            }
          }
        >
          {request.options.children}
          {error && (
            <p role="alert" className="text-caption text-error-text">
              {error}
            </p>
          )}
        </ConfirmDialog>
      )}
    </ConfirmContext.Provider>
  );
}
