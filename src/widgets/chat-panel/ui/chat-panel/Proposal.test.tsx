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
  useInventory: () => ({
    data: [{ id: "milk", name: "서울우유", mode: "quantity", unit_id: "pack" }],
  }),
  useInventoryMeta: () => ({
    data: {
      categories: [
        { id: "dairy", name: "유제품·계란" },
        { id: "other", name: "기타" },
      ],
      locations: [{ id: "fridge", name: "냉장실", enabled: true }],
      units: [
        { id: "piece", name: "개" },
        { id: "pack", name: "팩" },
      ],
    },
    isError: false,
  }),
}));
it.each([
  ["cart", "add", "우유 2개 장바구니에 담을까요 (유제품·계란)?"],
  ["cart", "save", "우유 2개 장바구니에 수정할까요 (유제품·계란)?"],
  ["inventory", "save", "우유 2개 재고를 추가할까요 (유제품·계란)?"],
] as const)(
  "INV-11 CART-11 SCN-BOT-6 %s %s 확인에 카테고리가 보이고 수정할 수 있어요",
  (domain, action, label) => {
    const payload = { action, item: { name: "우유", category_id: "dairy" } };
    const editable: ActionProposal = {
      ...proposal,
      actions: [{ domain, label, expected: {}, payload }],
    };
    render(<ChatActionProposal proposal={editable} now={now} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "유제품·계란" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(
      screen.getByRole("button", { name: "유제품·계란", pressed: true }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "기타" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [
          {
            ...editable.actions[0],
            payload: { action, item: { name: "우유", category_id: "other" } },
          },
        ],
      }),
      expect.any(Object),
    );
  },
);
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
const excludedItem = {
  ...receipt.items[0],
  name: "사과",
  selected: false,
};
const review = () => screen.getByRole("button", { name: "재고에 반영하기" });
const milkRow = () => screen.getByRole("button", { name: /^우유 ·/ });

it("INV-17 SCN-BOT-6 재고 변경은 바로 반영하고 품목과 눌린 확인을 남겨요", () => {
  const change = {
    ...receipt,
    kind: "proposal" as const,
    items: [{ ...receipt.items[0], unit_id: "pack" }, excludedItem],
  };
  const view = render(<ReceiptCard receipt={change} now={now} />);
  fireEvent.click(review());
  expect(mutate).toHaveBeenCalledExactlyOnceWith({
    id: change.id,
    version: change.version,
    items: change.items,
  });

  view.rerender(
    <ReceiptCard receipt={{ ...change, status: "applied" }} now={now} />,
  );
  expect(screen.getByRole("heading", { name: "재고 변경 확인" })).toBeVisible();
  const name = screen.getByRole("textbox", { name: "품목 1 이름" });
  expect(name).toHaveValue("우유");
  expect(name).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "확인", pressed: true }),
  ).toBeDisabled();
  expect(screen.queryByText(/개를 재고에 반영했어요/)).not.toBeInTheDocument();
});

describe("INV-17 SCN-BOT-6 영수증 확인 응답", () => {
  it("반영 후에는 완료 문구와 체크했던 품목만 남아요", () => {
    render(
      <ReceiptCard
        receipt={{
          ...receipt,
          status: "applied",
          items: [{ ...receipt.items[0], unit_id: "pack" }, excludedItem],
        }}
        now={now + 3600000}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "1개를 재고에 반영했어요",
    );
    expect(screen.getByText("우유 · 2 팩 · 새 품목")).toBeInTheDocument();
    expect(screen.queryByText(/사과/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
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
  it("품목 정보를 순서대로 요약하고 수정 칸을 각각 열고 닫아요", () => {
    const item = {
      ...receipt.items[0],
      unit_id: "pack",
      category_id: "dairy",
      location_id: "fridge",
      expires_on: "2026-11-30",
    };
    render(
      <ReceiptCard
        receipt={{
          ...receipt,
          items: [item, { ...excludedItem, reason: "사과를 확인해 주세요." }],
        }}
        now={now}
      />,
    );
    expect(milkRow()).toHaveTextContent(
      "우유 · 2 팩 · 2026-11-30 유제품·계란 | 냉장실 | 새 품목",
    );
    expect(milkRow()).toHaveAccessibleName(
      /^우유 · 2 팩 · 2026-11-30 집사 코멘트: 영수증 품목 유제품·계란 냉장실 새 품목/,
    );
    const appleRow = screen.getByRole("button", { name: /^사과 ·/ });
    const milkCheckbox = screen.getByRole("checkbox", {
      name: "품목 1 우유 반영",
    });
    expect(milkRow()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(milkCheckbox);
    expect(milkRow()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(milkRow());
    fireEvent.click(appleRow);
    expect(screen.getByRole("textbox", { name: "품목 1 이름" })).toHaveValue(
      "우유",
    );
    expect(screen.getByRole("textbox", { name: "품목 2 이름" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "품목 1 단위" })).toHaveValue(
      "pack",
    );
    expect(screen.getByText("영수증 품목")).toBeVisible();
    expect(screen.getByText("사과를 확인해 주세요.")).toBeVisible();
    fireEvent.click(milkRow());
    expect(milkRow()).toHaveAttribute("aria-expanded", "false");
    expect(appleRow).toHaveAttribute("aria-expanded", "true");
    expect(milkCheckbox).not.toBeChecked();
  });

  it("체크한 품목의 빠진 단위를 알리고 단위를 고르면 반영할 수 있어요", () => {
    const item = { ...receipt.items[0], selected: false };
    render(<ReceiptCard receipt={{ ...receipt, items: [item] }} now={now} />);
    expect(
      screen.queryByRole("img", { name: "확인 필요: 단위 필요" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "집사 코멘트: 영수증 품목" }),
    ).toBeVisible();
    expect(screen.queryByText("단위 필요")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "품목 1 우유 반영" }));
    expect(
      screen.getByRole("img", { name: "확인 필요: 단위 필요" }),
    ).toBeVisible();
    expect(review()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "단위가 빠진 품목 1개를 확인해 주세요.",
    );
    expect(screen.queryByText("단위 필요")).not.toBeInTheDocument();

    fireEvent.click(milkRow());
    const unit = screen.getByRole("combobox", { name: "품목 1 단위" });
    expect(unit).toBeInvalid();
    expect(unit).toHaveAccessibleDescription("단위 필요");
    fireEvent.change(unit, { target: { value: "pack" } });
    expect(unit).not.toBeInvalid();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("단위 필요")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /확인 필요/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "집사 코멘트: 영수증 품목" }),
    ).toBeVisible();
    expect(review()).toBeEnabled();
  });

  it("이름과 수량의 오류를 함께 알리고 두 값을 고치면 반영할 수 있어요", () => {
    const item = { ...receipt.items[0], unit_id: "pack", reason: "" };
    render(<ReceiptCard receipt={{ ...receipt, items: [item] }} now={now} />);
    fireEvent.click(milkRow());
    const name = screen.getByRole("textbox", { name: "품목 1 이름" });
    const quantity = screen.getByRole("spinbutton", { name: "품목 1 수량" });
    fireEvent.change(name, { target: { value: " " } });
    fireEvent.change(quantity, { target: { value: "" } });
    expect(name).toBeInvalid();
    expect(quantity).toBeInvalid();
    expect(screen.getByRole("status")).toHaveTextContent(
      "이름이 빠진 품목 1개 · 수량이 올바르지 않은 품목 1개를 확인해 주세요.",
    );
    expect(review()).toBeDisabled();

    fireEvent.change(name, { target: { value: "우유" } });
    fireEvent.change(quantity, { target: { value: "1" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(review()).toBeEnabled();
  });

  it("체크한 품목만 확인하고 돌아가도 선택과 수정값을 유지해요", () => {
    render(
      <ReceiptCard
        receipt={{ ...receipt, items: [...receipt.items, excludedItem] }}
        now={now}
      />,
    );
    expect(screen.getByText("2개 중 1개 선택")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "품목 2 사과 반영" }));
    expect(screen.getByText("2개 중 2개 선택")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^사과 ·/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "품목 2 이름" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /품목 2/ }));
    fireEvent.click(milkRow());
    fireEvent.change(screen.getByRole("spinbutton", { name: "품목 1 수량" }), {
      target: { value: "3" },
    });
    expect(
      screen.getByRole("option", { name: "서울우유 · 이름이 비슷해요" }),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("combobox", { name: "품목 1 기존 재고 연결" }),
      { target: { value: "milk" } },
    );
    fireEvent.click(review());
    expect(mutate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "1개를 재고에 반영할게요" }),
    ).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("우유 · 3 팩 · 기존 품목 서울우유")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));
    expect(screen.getByText("2개 중 1개 선택")).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: "품목 1 우유 반영" }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /품목 2/ })).not.toBeChecked();
    expect(milkRow()).toHaveAccessibleName(/^우유 · 3 팩/);
    expect(milkRow()).toHaveTextContent("기존 품목");
    expect(milkRow()).not.toHaveTextContent("서울우유");
    expect(review()).toHaveFocus();
    fireEvent.click(review());
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "반영하기" }));
    expect(mutate).toHaveBeenCalledExactlyOnceWith({
      id: receipt.id,
      version: receipt.version,
      items: [
        {
          ...receipt.items[0],
          quantity: 3,
          inventory_item_id: "milk",
          unit_id: "pack",
        },
      ],
    });
  });
});
