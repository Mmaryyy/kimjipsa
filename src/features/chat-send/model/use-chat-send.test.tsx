import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { postChat } from "@/entities/chat-message";
import { useChatSend } from "./use-chat-send";
vi.mock("@/entities/chat-message", () => ({
  postChat: vi.fn(async () => undefined),
  uploadPhoto: vi.fn(),
}));
it("BOT-07 선택 라벨을 초안·첨부 없이 개인 메시지로 보내요", async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useChatSend(3), { wrapper });
  act(() => result.current.onText("아직 쓰고 있는 초안"));
  act(() => result.current.send.mutate("개인 일정"));
  await waitFor(() => expect(result.current.send.isSuccess).toBe(true));
  expect(postChat).toHaveBeenCalledExactlyOnceWith({
    sessionVersion: 3,
    text: "개인 일정",
    attachmentIds: [],
    clientRequestId: expect.any(String),
  });
  client.clear();
});

it("BOT-07 전송 실패 뒤 다른 답은 새 요청 번호로 보내요", async () => {
  vi.mocked(postChat).mockClear();
  vi.mocked(postChat).mockRejectedValueOnce(new Error("network"));
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useChatSend(3), { wrapper });
  act(() => result.current.send.mutate("개인 일정"));
  await waitFor(() => expect(result.current.send.isError).toBe(true));
  act(() => result.current.send.mutate("공유 일정"));
  await waitFor(() => expect(result.current.send.isSuccess).toBe(true));
  const calls = vi.mocked(postChat).mock.calls;
  expect(calls[0][0].clientRequestId).not.toBe(calls[1][0].clientRequestId);
  expect(calls[1][0].text).toBe("공유 일정");
  client.clear();
});

it("BOT-07 대화 세션이 바뀌면 공유 전송 훅의 초안도 비워요", () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender } = renderHook(
    ({ version }) => useChatSend(version),
    {
      wrapper,
      initialProps: { version: 1 },
    },
  );
  act(() => result.current.onText("이전 대화 초안"));
  rerender({ version: 2 });
  expect(result.current.text).toBe("");
  expect(result.current.photos).toEqual([]);
  client.clear();
});
