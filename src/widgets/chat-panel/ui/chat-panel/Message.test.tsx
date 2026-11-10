import { fireEvent, render, screen, within } from "@testing-library/react";
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
  choices: [],
};
const run: Chat["runs"][number] = {
  id: "run",
  input_message_id: message.id,
  created_at: message.created_at,
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
  retrying: false,
  canRetry: true,
  onRetry: vi.fn(),
  onCancel: vi.fn(),
};

describe("BOT-01 요청 상태 캡션", () => {
  it.each(["completed"] as const)("%s 상태는 숨겨요", (status) => {
    render(<ChatMessage {...props} run={{ ...run, status }} />);
    expect(screen.queryByLabelText("요청 진행 상태")).not.toBeInTheDocument();
    expect(screen.queryByText("전송됨")).not.toBeInTheDocument();
    expect(screen.queryByText("응답 완료")).not.toBeInTheDocument();
    expect(screen.getByText("오후 12:00")).toHaveAttribute(
      "dateTime",
      message.created_at,
    );
  });

  it.each([
    ["queued", "전송됨"],
    ["running", "방금 읽음"],
    ["failed", "처리하지 못했어요"],
    ["cancelled", "요청 취소됨"],
    ["unknown", "결과 확인 필요"],
  ] as const)(
    "%s 상태와 시간을 사용자 말풍선 안에 보여줘요",
    (status, label) => {
      render(<ChatMessage {...props} run={{ ...run, status }} />);
      const caption = screen.getByLabelText("요청 진행 상태");
      const bubble = screen.getByText(message.text).parentElement;
      expect(caption).toHaveTextContent(label);
      expect(caption).not.toHaveAttribute("aria-live");
      expect(caption).not.toHaveAttribute("role");
      expect(bubble).toContainElement(caption);
      expect(caption.parentElement).toHaveTextContent(`${label} · 오후 12:00`);
    },
  );

  it.each(["queued", "running"] as const)(
    "%s 전송 30초 뒤에만 취소하고 중복 요청을 막아요",
    (status) => {
      const onCancel = vi.fn();
      const { rerender } = render(
        <ChatMessage {...props} run={{ ...run, status }} onCancel={onCancel} />,
      );
      expect(
        screen.queryByRole("button", { name: "요청 취소" }),
      ).not.toBeInTheDocument();
      rerender(
        <ChatMessage
          {...props}
          run={{ ...run, status }}
          onCancel={onCancel}
          now={now + 29999}
        />,
      );
      expect(
        screen.queryByRole("button", { name: "요청 취소" }),
      ).not.toBeInTheDocument();
      rerender(
        <ChatMessage
          {...props}
          run={{ ...run, status }}
          onCancel={onCancel}
          now={now + 30000}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "요청 취소" }));
      expect(onCancel).toHaveBeenCalledWith(run.id);
      rerender(
        <ChatMessage
          {...props}
          run={{ ...run, status }}
          onCancel={onCancel}
          cancelling
          now={now + 30000}
        />,
      );
      expect(screen.getByRole("button", { name: "요청 취소" })).toBeDisabled();
    },
  );

  it.each([{ proposal }, { receipt }])(
    "완료된 요청은 확인 카드가 있어도 내 버블에는 시간만 보여줘요",
    (confirmation) => {
      render(
        <ChatMessage
          {...props}
          {...confirmation}
          run={{ ...run, status: "completed" }}
        />,
      );
      const bubble = screen.getByText(message.text).parentElement!;
      expect(within(bubble).queryByLabelText("요청 진행 상태")).toBeNull();
      expect(within(bubble).getByText("오후 12:00")).toBeInTheDocument();
      const card = screen.getByText(
        "proposal" in confirmation ? "변경 확인 카드" : "영수증 카드",
      );
      expect(
        within(card.closest(".is-assistant") as HTMLElement).getByText(
          "김집사",
        ),
      ).toHaveClass("sr-only");
      expect(
        within(card.parentElement!).getByText("오후 12:00"),
      ).toHaveAttribute("dateTime");
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

it.each(["failed"] as const)(
  "BOT-01 %s 캡션에 오류 이유를 표시해요",
  (status) => {
    render(
      <ChatMessage
        {...props}
        run={{ ...run, status, error_code: "lease_expired" }}
      />,
    );
    const bubble = screen.getByText(message.text).parentElement!;
    expect(screen.getByText(chatErrors.lease_expired)).toBeVisible();
    expect(bubble).not.toContainElement(
      screen.getByText(chatErrors.lease_expired),
    );
    expect(bubble).not.toContainElement(
      screen.getByRole("button", { name: "재시도" }),
    );
  },
);

vi.mock("@/features/account", () => ({
  useBotCharacter: () => ({ avatar: "/images/kimjipsa-avatar.png" }),
}));

it.each([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "unknown",
] as const)(
  "BOT-01 %s 상태 중 running에서만 집사 자리에 입력 중을 보여줘요",
  (status) => {
    render(<ChatMessage {...props} run={{ ...run, status }} />);
    const typing = screen.queryByText("집사가 답을 쓰는 중");
    if (status === "running") {
      expect(typing).toBeInTheDocument();
      expect(typing?.closest(".is-assistant")).toContainElement(typing);
    } else expect(typing).not.toBeInTheDocument();
  },
);
it.each(["cancelled", "failed", "unknown"] as const)(
  "BOT-01 %s 요청 재시도는 같은 버블을 유지하고 전송됨으로 돌아가요",
  (status) => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <ChatMessage {...props} run={{ ...run, status }} onRetry={onRetry} />,
    );
    const bubble = screen.getByText(message.text);
    fireEvent.click(screen.getByRole("button", { name: "재시도" }));
    expect(onRetry).toHaveBeenCalledWith(run.id);
    rerender(<ChatMessage {...props} run={{ ...run, status }} retrying />);
    expect(screen.getByRole("button", { name: "재시도" })).toBeDisabled();
    rerender(
      <ChatMessage
        {...props}
        run={{ ...run, id: "retry", status: "queued" }}
      />,
    );
    expect(screen.getAllByText(message.text)).toHaveLength(1);
    expect(screen.getByText(message.text)).toBe(bubble);
    expect(screen.getByLabelText("요청 진행 상태")).toHaveTextContent("전송됨");
    expect(
      screen.queryByRole("button", { name: "재시도" }),
    ).not.toBeInTheDocument();
  },
);

it.each(["queued", "running"] as const)(
  "BOT-01 오래된 메시지를 재시도한 %s 요청은 새 요청 생성 30초 뒤에 취소할 수 있어요",
  (status) => {
    const retryAt = now + 60000;
    const retryRun = {
      ...run,
      id: "retry",
      status,
      created_at: new Date(retryAt).toISOString(),
    };
    const { rerender } = render(
      <ChatMessage
        {...props}
        run={{ ...run, status: "failed" }}
        now={retryAt}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "재시도" }));
    rerender(<ChatMessage {...props} run={retryRun} now={retryAt} />);
    expect(
      screen.queryByRole("button", { name: "요청 취소" }),
    ).not.toBeInTheDocument();
    rerender(<ChatMessage {...props} run={retryRun} now={retryAt + 29999} />);
    expect(
      screen.queryByRole("button", { name: "요청 취소" }),
    ).not.toBeInTheDocument();
    rerender(<ChatMessage {...props} run={retryRun} now={retryAt + 30000} />);
    expect(
      screen.getByRole("button", { name: "요청 취소" }),
    ).toBeInTheDocument();
  },
);

it("BOT-01 이전 실패는 상태만 보여 주고 하위 live 영역을 만들지 않아요", () => {
  const { container } = render(
    <ChatMessage
      {...props}
      canRetry={false}
      run={{ ...run, status: "failed" }}
    />,
  );
  expect(screen.getByLabelText("요청 진행 상태")).toHaveTextContent(
    "처리하지 못했어요",
  );
  expect(
    screen.queryByRole("button", { name: "재시도" }),
  ).not.toBeInTheDocument();
  expect(container.querySelector('[role="status"], [aria-live]')).toBeNull();
});

it.each(["user", "assistant"] as const)(
  "BOT-01 %s 이름은 숨기고 시간만 표시해요",
  (role) => {
    render(
      <ChatMessage
        {...props}
        run={undefined}
        message={{ ...message, role, author: "김데비" }}
      />,
    );
    expect(screen.getByText(role === "user" ? "나" : "김데비")).toHaveClass(
      "sr-only",
    );
    const time = screen.getByText("오후 12:00");
    expect(time).toHaveAttribute("dateTime", message.created_at);
    expect(screen.queryByText(/11\. 4\./)).not.toBeInTheDocument();
    expect(screen.getByText(message.text).parentElement).toContainElement(time);
  },
);
