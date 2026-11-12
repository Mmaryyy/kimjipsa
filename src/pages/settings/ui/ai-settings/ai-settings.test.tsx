import { ConfirmTestProvider as ConfirmProvider } from "@/shared/ui/confirm-test-provider";
import type { ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render as renderWithoutConfirm,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import AiSettings from ".";
import { ToastProvider } from "@/shared/ui";

const render = (ui: ReactElement) =>
  renderWithoutConfirm(ui, { wrapper: ConfirmProvider });

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
      mutateAsync: memory,
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
it("BOT-13 기억 목록을 누르면 시트에서 바뀐 내용만 저장해요", () => {
  render(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  expect(screen.queryByLabelText("기억 내용")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "우유는 저지방" }));
  expect(screen.getByRole("dialog", { name: "가족 기억" })).toHaveTextContent(
    "우유는 저지방",
  );
  expect(screen.queryByLabelText("기억 내용")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "기억 수정" }));
  const sheet = within(screen.getByRole("dialog", { name: "가족 기억 수정" }));
  expect(sheet.getByLabelText("기억 내용")).toHaveValue("우유는 저지방");
  fireEvent.click(sheet.getByRole("button", { name: "저장" }));
  expect(memory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "우유는 저지방" }));
  fireEvent.click(screen.getByRole("button", { name: "기억 수정" }));
  fireEvent.change(screen.getByLabelText("기억 내용"), {
    target: { value: "우유는 일반" },
  });
  fireEvent.blur(screen.getByLabelText("기억 내용"));
  expect(memory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(memory).toHaveBeenCalledWith(
    { action: "save-memory", id: "memory", version: 1, text: "우유는 일반" },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
});
it("BOT-13 새 기억은 목록 아래 버튼으로 시트를 열어 등록해요", () => {
  render(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  const section = screen.getByRole("region", { name: "가족 기억" });
  const add = within(section).getByRole("button", { name: "새 기억 추가" });
  const reset = within(section).getByRole("button", {
    name: "기억 전체 초기화",
  });
  expect(
    section.querySelector("ul")!.compareDocumentPosition(add) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    add.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(add);
  const sheet = within(screen.getByRole("dialog", { name: "새 기억 추가" }));
  expect(sheet.getByRole("button", { name: "저장" })).toBeDisabled();
  fireEvent.change(sheet.getByLabelText("기억 내용"), {
    target: { value: "아침은 간단히" },
  });
  fireEvent.click(sheet.getByRole("button", { name: "저장" }));
  expect(memory).toHaveBeenCalledWith(
    { action: "save-memory", text: "아침은 간단히" },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
  act(() => memory.mock.calls[0][1].onSuccess());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("BOT-13 개별 삭제와 전체 초기화는 확인해야 실행해요", async () => {
  render(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "우유는 저지방" }));
  fireEvent.click(screen.getByRole("button", { name: "기억 삭제" }));
  expect(memory).not.toHaveBeenCalled();
  let confirm = within(screen.getByRole("alertdialog"));
  fireEvent.click(confirm.getByRole("button", { name: "취소하기" }));
  expect(memory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "기억 삭제" }));
  confirm = within(screen.getByRole("alertdialog"));
  fireEvent.click(confirm.getByRole("button", { name: "삭제" }));
  expect(memory).toHaveBeenCalledWith({
    action: "delete-memory",
    id: "memory",
    version: 1,
  });
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "기억 전체 초기화" }));
  expect(memory).toHaveBeenCalledTimes(1);
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "삭제",
    }),
  );
  expect(memory).toHaveBeenLastCalledWith({ action: "reset-memories" });
});
it("BOT-13 저장 오류를 시트에 표시하고 오프라인과 대기 중에는 변경을 막아요", () => {
  const { rerender } = render(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "새 기억 추가" }));
  fireEvent.change(screen.getByLabelText("기억 내용"), {
    target: { value: "아침" },
  });
  connection.memoryError = new Error("저장 실패");
  connection.memoryPending = true;
  rerender(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("저장 실패");
  expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  connection.memoryPending = false;
  rerender(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  act(() => window.dispatchEvent(new Event("offline")));
  expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  expect(screen.getByLabelText("기억 내용")).toBeDisabled();
  vi.restoreAllMocks();
});
it("BOT-13 저장하지 않은 변경은 닫기 전에 확인해요", () => {
  render(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "새 기억 추가" }));
  fireEvent.change(screen.getByLabelText("기억 내용"), {
    target: { value: "아침" },
  });
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  const confirm = within(screen.getByRole("alertdialog"));
  fireEvent.click(confirm.getByRole("button", { name: "저장 안 함" }));
  expect(memory).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

it("BOT-13 P15.1b 수정 취소로 보기로 돌아오고 다시 수정할 수 있어요", () => {
  render(
    <ToastProvider>
      <AiSettings />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "우유는 저지방" }));
  fireEvent.click(screen.getByRole("button", { name: "기억 수정" }));
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.getByRole("button", { name: "기억 수정" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "기억 수정" }));
  expect(screen.getByLabelText("기억 내용")).toHaveValue("우유는 저지방");
  expect(memory).not.toHaveBeenCalled();
});
