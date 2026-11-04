import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  chatErrors,
  type Chat,
  type ActionProposal,
  type Receipt,
} from "@/entities/chat-message";
import ChatMessage from "./Message";

vi.mock("./Proposal", () => ({ default: () => <div>변경 확인 카드</div> }));
vi.mock("./Receipt", () => ({ default: () => <div>영수증 카드</div> }));

const now = Date.parse("2026-11-04T03:00:00Z");
const message: Chat["messages"][number] = {
  id: "message",
  sequence: 1,
  role: "user",
  text: "우유를 담아줘",
  author: "나",
  created_at: "2026-11-04T03:00:00Z",
  visibility: "private",
  attachment_ids: [],
  sources: [],
};
const run: Chat["runs"][number] = {
  id: "run",
  input_message_id: message.id,
  status: "running",
  progress: "",
  version: 1,
  error_code: null,
};
const proposal: ActionProposal = {
  id: "proposal",
  run_id: run.id,
  status: "draft",
  version: 1,
  expires_at: "2026-11-04T03:05:00Z",
  actions: [],
};
const receipt: Receipt = {
  id: "receipt",
  run_id: run.id,
  kind: "receipt",
  status: "draft",
  version: 1,
  expires_at: proposal.expires_at,
  items: [],
};
const props = {
  message,
  run,
  attachments: new Map(),
  now,
  cancelling: false,
  onCancel: vi.fn(),
};

describe("BOT-01 요청 상태 캡션", () => {
  it.each(["completed"] as const)("%s 상태는 숨겨요", (status) => {
    render(<ChatMessage {...props} run={{ ...run, status }} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("요청 대기")).not.toBeInTheDocument();
    expect(screen.queryByText("응답 완료")).not.toBeInTheDocument();
  });

  it.each([
    ["queued", "요청 대기"],
    ["running", "집사가 처리 중"],
    ["failed", "처리하지 못했어요"],
    ["cancelled", "요청 취소됨"],
    ["unknown", "결과 확인 필요"],
  ] as const)("%s 상태를 사용자 말풍선 바로 밖에 보여줘요", (status, label) => {
    render(<ChatMessage {...props} run={{ ...run, status }} />);
    const caption = screen.getByRole("status");
    const bubble = screen.getByText(message.text).parentElement;
    expect(caption).toHaveTextContent(label);
    expect(caption).toHaveAttribute("aria-live", "polite");
    expect(bubble?.nextElementSibling).toBe(caption);
  });

  it.each(["queued", "running"] as const)(
    "%s 취소와 중복 요청 방지를 유지해요",
    (status) => {
      const onCancel = vi.fn();
      const { rerender } = render(
        <ChatMessage {...props} run={{ ...run, status }} onCancel={onCancel} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "요청 취소" }));
      expect(onCancel).toHaveBeenCalledWith(run.id);
      rerender(
        <ChatMessage
          {...props}
          run={{ ...run, status }}
          onCancel={onCancel}
          cancelling
        />,
      );
      expect(screen.getByRole("button", { name: "요청 취소" })).toBeDisabled();
    },
  );

  it.each([{ proposal }, { receipt }])(
    "완료된 요청도 확인할 내용이 남으면 캡션을 보여줘요",
    (confirmation) => {
      const { rerender } = render(
        <ChatMessage
          {...props}
          {...confirmation}
          run={{ ...run, status: "completed" }}
        />,
      );
      expect(screen.getByRole("status")).toHaveTextContent("내용 확인 대기");
      rerender(
        <ChatMessage
          {...props}
          {...confirmation}
          run={{ ...run, status: "completed" }}
          now={now + 300000}
        />,
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );

  it.each(["user", "assistant"] as const)(
    "%s 말풍선 밖 집사 줄에 확인 카드와 영수증을 보여줘요",
    (role) => {
      render(
        <ChatMessage
          {...props}
          message={{ ...message, role, text: "확인해 주세요" }}
          proposal={proposal}
          receipt={receipt}
        />,
      );
      const bubble = screen.getByText("확인해 주세요").parentElement;
      const proposalCard = screen.getByText("변경 확인 카드");
      const receiptCard = screen.getByText("영수증 카드");
      expect(bubble).not.toContainElement(proposalCard);
      expect(bubble).not.toContainElement(receiptCard);
      expect(proposalCard.closest(".is-assistant")).toContainElement(
        receiptCard,
      );
      expect(proposalCard.closest(".is-user")).toBeNull();
      expect(receiptCard.closest(".is-user")).toBeNull();
    },
  );
});

it.each(["failed", "unknown"] as const)(
  "BOT-01 %s 캡션에 오류 이유를 표시해요",
  (status) => {
    render(
      <ChatMessage
        {...props}
        run={{ ...run, status, error_code: "lease_expired" }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      chatErrors.lease_expired,
    );
  },
);
