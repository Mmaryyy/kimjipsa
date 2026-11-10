import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { retryChat } from "../api/api";
import { useChatActions } from "./use-chat";

vi.mock("../api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  retryChat: vi.fn(),
}));

it("BOT-14 만료된 요청 재시도는 대화를 다시 조회해요", async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  vi.mocked(retryChat).mockRejectedValue(
    new ApiError("chat_expired", "대화가 만료되었어요", 410),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useChatActions(), { wrapper });
  act(() =>
    result.current.retry.mutate({ id: "run", clientRequestId: "request" }),
  );
  await waitFor(() => expect(result.current.retry.isError).toBe(true));
  expect(result.current.retry.error?.message).toBe("대화가 만료되었어요");
  expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: ["chat"] });
  client.clear();
});
