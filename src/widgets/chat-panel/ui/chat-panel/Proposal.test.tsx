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
  it("SCN-BOT-7 남은 시간을 최대 5분의 분:초로 표시해요", () => {
    const { rerender } = render(
      <ChatActionProposal proposal={proposal} now={now - 1000} />,
    );
    expect(screen.getByText(/남은 시간 5:00/)).toBeInTheDocument();
    rerender(<ChatActionProposal proposal={proposal} now={now + 1001} />);
    expect(screen.getByText(/남은 시간 4:59/)).toBeInTheDocument();
    rerender(<ChatActionProposal proposal={proposal} now={now + 299001} />);
    expect(screen.getByText(/남은 시간 0:01/)).toBeInTheDocument();
  });
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
it("BOT-11/14 개인 대화와 1시간 보관 안내만 보여줘요", () => {
  render(<ChatHeader name="집사" online failed={false} />);
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.getByText("나만 보는 대화")).toBeInTheDocument();
  expect(
    screen.getByText("마지막 메시지 후 1시간이 지나면 대화 기록이 삭제돼요."),
  ).toBeInTheDocument();
});
