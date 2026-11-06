import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AiSettings from ".";
import { ToastProvider } from "@/shared/ui";

const { saveType, save, memory, settings, connection, account } = vi.hoisted(
  () => ({
    connection: {
      failed: false,
      refetch: vi.fn(),
      pending: false,
      memoryPending: false,
      memoryError: null as Error | null,
    },
    account: { role: "admin" },
    saveType: vi.fn(),
    save: vi.fn(),
    memory: vi.fn(),
    settings: {
      name: "집사",
      memoryEnabled: true,
      version: 1,
      memoryVersion: 1,
      memories: [{ id: "memory", text: "우유는 저지방", version: 1 }],
    },
  }),
);
vi.mock("@/entities/chat-message", () => ({
  useAiSettings: () => ({
    query: { data: settings },
    save: { mutateAsync: save, isPending: connection.pending },
    memory: {
      mutate: memory,
      reset: vi.fn(),
      isPending: connection.memoryPending,
      error: connection.memoryError,
    },
  }),
  useChat: () => ({
    data: { workerOnline: true },
    isError: connection.failed,
    refetch: connection.refetch,
  }),
}));
vi.mock("@/features/account", () => ({
  useBotCharacter: () => ({
    avatar: "/images/kimjipsa-avatar.png",
    label: "집사",
  }),
  useSaveBotType: () => ({ mutate: saveType, isPending: false }),
  useAccount: () => ({
    data: {
      userId: "user",
      membership: { role: account.role, familyId: "family" },
    },
  }),
}));
beforeEach(() => {
  saveType.mockReset();
  save.mockReset().mockResolvedValue(null);
  memory.mockReset();
  account.role = "admin";
  connection.failed = false;
  connection.pending = false;
  connection.memoryPending = false;
  connection.memoryError = null;
  connection.refetch.mockReset();
});
it("BOT-15/16 이름 변경과 기억 스위치는 달라졌을 때만 자동 저장해요", async () => {
  render(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  const name = screen.getByLabelText("이름");
  fireEvent.blur(name);
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(name, { target: { value: "데비" } });
  fireEvent.blur(name);
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({ name: "데비", memoryEnabled: true }),
  );
  await screen.findByText("집사 설정을 저장했어요");
  fireEvent.click(
    screen.getByRole("switch", { name: "앱의 가족 기억 사용하기" }),
  );
  await waitFor(() =>
    expect(save).toHaveBeenLastCalledWith({
      name: "데비",
      memoryEnabled: false,
    }),
  );
  expect(screen.getByText("연결됨")).toBeInTheDocument();
});
it("BOT-13 가족 기억은 바뀐 내용만 저장하고 새 기억을 추가해요", () => {
  render(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  const input = screen.getByLabelText("기억 내용");
  fireEvent.blur(input);
  expect(memory).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "우유는 일반" } });
  fireEvent.blur(input);
  expect(memory).toHaveBeenCalledWith({
    action: "save-memory",
    id: "memory",
    version: 1,
    text: "우유는 일반",
  });
  fireEvent.change(screen.getByLabelText("새 가족 기억"), {
    target: { value: "아침은 간단히" },
  });
  fireEvent.click(screen.getByRole("button", { name: "추가" }));
  expect(memory).toHaveBeenLastCalledWith(
    { action: "save-memory", text: "아침은 간단히" },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
});
it("BOT-15 저장에 실패하면 이전 설정으로 돌아와요", async () => {
  save.mockRejectedValueOnce(new Error("실패"));
  render(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  const name = screen.getByLabelText("이름");
  fireEvent.change(name, { target: { value: "데비" } });
  fireEvent.blur(name);
  await waitFor(() => expect(name).toHaveValue("집사"));
});

it.each(["member", "admin"])(
  "BOT-16 %s도 저장 여부와 관계없이 맥미니 연결을 다시 확인해요",
  (role) => {
    account.role = role;
    connection.failed = true;
    connection.pending = true;
    render(
      <ToastProvider>
        <AiSettings />
      </ToastProvider>,
    );
    const retry = screen.getByRole("button", {
      name: "연결 확인 실패 · 다시 확인",
    });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(connection.refetch).toHaveBeenCalledOnce();
  },
);

it("BOT-18 구성원도 타입을 바꾸고 같은 기본값은 저장하지 않아요", () => {
  account.role = "member";
  render(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  expect(screen.getByAltText("집사 미리보기")).toHaveAttribute("width", "48");
  fireEvent.click(screen.getByRole("radio", { name: "집사" }));
  expect(saveType).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("radio", { name: "노비" }));
  expect(saveType).toHaveBeenCalledWith(
    "nobi",
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
  expect(save).not.toHaveBeenCalled();
});
