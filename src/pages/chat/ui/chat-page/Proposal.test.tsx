import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ActionProposal } from "@/entities/chat-message";
import ChatActionProposal from "./Proposal";
import ChatHeader from "./Header";
const mutate = vi.hoisted(() => vi.fn());
vi.mock("@/entities/chat-message", () => ({
  useChatActions: () => ({
    actions: { mutate, isPending: false, error: null },
  }),
}));
const proposal: ActionProposal = {
  id: "proposal",
  run_id: "run",
  status: "draft",
  version: 1,
  expires_at: "2026-11-04T03:05:00Z",
  actions: [
    { domain: "inventory", label: "우유 삭제", payload: {}, expected: {} },
    { domain: "event", label: "약속 변경", payload: {}, expected: {} },
  ],
};
const now = Date.parse("2026-11-04T03:00:00Z");
beforeEach(() => mutate.mockClear());
describe("BOT-08 변경 제안", () => {
  it("SCN-BOT-6 선택한 항목만 확인 요청에 포함해요", () => {
    render(<ChatActionProposal proposal={proposal} now={now} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "우유 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "선택한 변경 실행" }));
    expect(mutate).toHaveBeenCalledWith({
      id: "proposal",
      version: 1,
      selected: [1],
    });
  });
  it("SCN-BOT-7 만료된 제안은 실행할 수 없어요", () => {
    render(<ChatActionProposal proposal={proposal} now={now + 300000} />);
    expect(
      screen.queryByRole("button", { name: "선택한 변경 실행" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "우유 삭제" })).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });
  it("취소는 변경 항목을 전송하지 않아요", () => {
    render(<ChatActionProposal proposal={proposal} now={now} />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(mutate).toHaveBeenCalledWith({
      id: "proposal",
      version: 1,
      selected: [],
      cancel: true,
    });
  });
});
it("BOT-10 나만 보기 모드 선택과 비공개 안내를 보여줘요", () => {
  const onVisibilityChange = vi.fn();
  const { rerender } = render(
    <ChatHeader
      visibility="shared"
      onVisibilityChange={onVisibilityChange}
      name="집사"
      online
      failed={false}
    />,
  );
  fireEvent.click(screen.getByRole("radio", { name: "나만 보기" }));
  expect(onVisibilityChange).toHaveBeenCalledWith("private");
  rerender(
    <ChatHeader
      visibility="private"
      onVisibilityChange={onVisibilityChange}
      name="집사"
      online
      failed={false}
    />,
  );
  expect(
    screen.getByText("나만 보는 대화 · 가족 기억에 저장하지 않아요"),
  ).toBeInTheDocument();
});
