import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const fetchAccount = vi.fn();
vi.mock("../api/api", () => ({
  fetchAccount: () => fetchAccount(),
  signIn: vi.fn(),
  updateProfile: vi.fn(),
  updateBotType: vi.fn(),
}));

const { useBotCharacter } = await import("./use-account");

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

describe("BOT-18 시작 화면 캐릭터는 바뀌어 보이지 않아요", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => fetchAccount.mockReset());

  it("기기에 기억한 타입이 없으면 계정을 받기 전까지 비워 두고, 받은 타입을 기억해요", async () => {
    let resolve: (value: unknown) => void = () => {};
    fetchAccount.mockReturnValue(new Promise((done) => (resolve = done)));
    const { result } = renderHook(() => useBotCharacter(), { wrapper });
    expect(result.current.ready).toBe(false);
    resolve({ botType: "nobi" });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.full).toBe("/images/nobi/nobi-full.png");
    expect(localStorage.getItem("kimjipsa-bot-type")).toBe("nobi");
  });

  it("기억한 타입이 있으면 계정을 받기 전에도 그 타입으로 바로 보여요", () => {
    localStorage.setItem("kimjipsa-bot-type", "nobi");
    fetchAccount.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useBotCharacter(), { wrapper });
    expect(result.current.ready).toBe(true);
    expect(result.current.full).toBe("/images/nobi/nobi-full.png");
  });
});
