import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as EventEntity from "@/entities/event";
import type * as InventoryEntity from "@/entities/inventory-item";
import type { ActionProposal, Receipt } from "@/entities/chat-message";
import ChatActionProposal from "./Proposal";
import ChatHeader from "./Header";
import ReceiptCard from "./Receipt";
const mutate = vi.hoisted(() => vi.fn());
vi.mock("@/features/account", () => ({
  useBotCharacter: () => ({ avatar: "/images/kimjipsa-avatar.png" }),
}));
vi.mock("@/entities/chat-message", () => ({
  useChatActions: () => ({
    actions: { mutate, isPending: false, error: null },
    receipt: { mutate, isPending: false, error: null },
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
  it("SCN-BOT-7 시간이 지나도 타이머 없이 수정·확인할 수 있어요", () => {
    render(<ChatActionProposal proposal={proposal} now={now + 3600000} />);
    expect(screen.queryByText(/남은 시간|선택한 변경/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "이렇게 반영할까요?" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확인" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "수정" })).toBeEnabled();
  });
  it("SCN-BOT-6 뺀 줄을 제외하고 확인하며 모두 빼면 확인할 수 없어요", () => {
    render(<ChatActionProposal proposal={proposal} now={now} />);
    fireEvent.click(screen.getByRole("button", { name: "우유 삭제 빼기" }));
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(mutate).toHaveBeenCalledWith({
      id: "proposal",
      version: 1,
      selected: [1],
    });
    fireEvent.click(screen.getByRole("button", { name: "약속 변경 빼기" }));
    expect(screen.getByRole("button", { name: "확인" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "우유 삭제 되돌리기" }));
    expect(screen.getByRole("button", { name: "확인" })).toBeEnabled();
  });
  it("SCN-BOT-6 반영 후 항목과 눌린 확인 버튼만 남아요", () => {
    render(
      <ChatActionProposal
        proposal={{ ...proposal, status: "applied" }}
        now={now}
      />,
    );
    expect(screen.getByText("우유 삭제")).toBeInTheDocument();
    expect(screen.getByText("약속 변경")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "확인", pressed: true }),
    ).toBeDisabled();
  });
  it("SCN-BOT-6 취소 후 요청 처리 취소 문구만 남아요", () => {
    render(
      <ChatActionProposal
        proposal={{ ...proposal, status: "cancelled", actions: [] }}
        now={now}
      />,
    );
    expect(screen.getByText("요청 처리를 취소했어요.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
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
it("BOT-11 이름과 연결 배지를 보여주고 공개 범위 전환은 없어요", () => {
  render(<ChatHeader name="집사" online failed={false} />);
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "김집사" })).toBeInTheDocument();
  expect(screen.getByText("연결됨(맥미니)")).toBeInTheDocument();
  expect(screen.queryByText("나만 보는 대화")).not.toBeInTheDocument();
  expect(screen.queryByText(/1시간/)).not.toBeInTheDocument();
});

vi.mock("@/entities/event", async (original) => ({
  ...(await original<typeof EventEntity>()),
  useEventCategories: () => ({ data: [], isError: false }),
}));
vi.mock("@/entities/inventory-item", async (original) => ({
  ...(await original<typeof InventoryEntity>()),
  useInventory: () => ({ data: [] }),
  useInventoryMeta: () => ({
    data: { categories: [], locations: [], units: [] },
    isError: false,
  }),
}));
it("BOT-08 SCN-BOT-6 같은 메시지 안에서 제목을 수정하고 저장해요", async () => {
  const editable: ActionProposal = {
    ...proposal,
    actions: [
      {
        domain: "event",
        label: "치과 등록",
        expected: {},
        payload: { id: null, event: { title: "치과", place: "", memo: "" } },
      },
    ],
  };
  render(<ChatActionProposal proposal={editable} now={now} />);
  fireEvent.click(screen.getByRole("button", { name: "수정" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: "정기 검진" },
  });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            payload: {
              id: null,
              event: { title: "정기 검진", place: "", memo: "" },
            },
          }),
        ],
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    ),
  );
});

it("BOT-08 SCN-BOT-6 단일 변경은 머리글 없이 질문과 세 버튼만 보여요", () => {
  const label =
    "11월 6일 종일, 데이부 워크샵을 회사 카테고리의 공유 일정으로 추가할까요?";
  render(
    <ChatActionProposal
      proposal={{ ...proposal, actions: [{ ...proposal.actions[0], label }] }}
      now={now}
    />,
  );
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(
    screen.getAllByRole("button").map((button) => button.textContent),
  ).toEqual(["확인", "수정", "취소"]);
});

const receipt: Receipt = {
  id: "receipt",
  run_id: "run",
  kind: "receipt",
  status: "draft",
  version: 1,
  expires_at: "2026-11-04T03:05:00Z",
  items: [
    {
      name: "우유",
      original_name: "우유",
      quantity: 2,
      selected: true,
      unit_id: null,
      inventory_item_id: null,
      category_id: null,
      location_id: null,
      expires_on: null,
      reason: "영수증 품목",
    },
  ],
};
describe("BOT-08 SCN-BOT-6 영수증 확인 응답", () => {
  it("반영 후 만료 시각이 지나도 품목과 눌린 확인만 남아요", () => {
    const { rerender } = render(<ReceiptCard receipt={receipt} now={now} />);
    rerender(
      <ReceiptCard
        receipt={{ ...receipt, status: "applied" }}
        now={now + 3600000}
      />,
    );
    expect(screen.getByRole("textbox", { name: "품목 1 이름" })).toHaveValue(
      "우유",
    );
    expect(screen.getByRole("textbox", { name: "품목 1 이름" })).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "품목 1 수량" })).toHaveValue(
      2,
    );
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "확인", pressed: true }),
    ).toBeDisabled();
  });
  it("취소 후 품목을 숨기고 요청 처리 취소 문구만 남아요", () => {
    render(
      <ReceiptCard
        receipt={{ ...receipt, status: "cancelled", items: [] }}
        now={now}
      />,
    );
    expect(screen.getByText("요청 처리를 취소했어요.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("확인 전에는 기존 편집과 반영·취소 버튼을 유지해요", () => {
    render(<ReceiptCard receipt={receipt} now={now} />);
    expect(screen.getByRole("textbox", { name: "품목 1 이름" })).toBeEnabled();
    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["재고에 반영하기", "취소하기"]);
  });
});
