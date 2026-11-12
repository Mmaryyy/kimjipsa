import { ConfirmTestProvider as ConfirmProvider } from "@/shared/ui/confirm-test-provider";
import type { ReactElement } from "react";
import { readFileSync } from "node:fs";
import {
  fireEvent,
  render as renderWithoutConfirm,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const fixture: unknown = JSON.parse(
  readFileSync("mocks/inventory-items.json", "utf8"),
);
const defaults: unknown = JSON.parse(
  readFileSync("mocks/inventory-defaults.json", "utf8"),
);
import type { InventoryItem, InventoryMeta } from "@/entities/inventory-item";
import InventoryItemEditor from ".";

const render = (ui: ReactElement) =>
  renderWithoutConfirm(ui, { wrapper: ConfirmProvider });
const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/entities/inventory-item", async (original) => ({
  ...(await original<object>()),
  useInventoryActions: () => ({
    save: { isPending: false, mutateAsync: save },
    change: { isPending: false },
  }),
}));
// These tests exercise the editor; the date wheel has its own integration coverage.
vi.mock("@/shared/ui/date-time-input", () => ({ DateTimeInput: () => null }));
const milk = (fixture as InventoryItem[])[0]!;
function editor(item?: InventoryItem, items = [milk]) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <InventoryItemEditor
        item={item}
        items={items}
        meta={defaults as InventoryMeta}
        onClose={vi.fn()}
        onNotify={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => save.mockReset().mockResolvedValue(milk.id));
describe("INV-07 SCN-INV-7 삭제 확인", () => {
  it("상세는 읽기 화면이고 삭제 취소 시 남으며 확인할 때만 지워요", async () => {
    editor(milk);
    expect(screen.queryByLabelText("품목 이름")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "품목 삭제" }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "품목 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ action: "delete", id: milk.id }),
    );
  });
});
describe("INV-10 INV-16 완전 일치 우선", () => {
  it("비슷한 이름이 앞에 있어도 같은 이름에 더해요", async () => {
    const similar = { ...milk, id: crypto.randomUUID(), name: "딸기우유" };
    editor(undefined, [similar, milk]);
    fireEvent.change(screen.getByLabelText("품목 이름"), {
      target: { value: "우유" },
    });
    // New items use the first unit, so select the existing item's unit.
    fireEvent.change(screen.getByLabelText("단위"), {
      target: { value: milk.unit_id },
    });
    fireEvent.click(screen.getByRole("button", { name: "기존 품목에 더하기" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        action: "merge",
        id: milk.id,
        delta: 1,
      }),
    );
  });
  it("완전 일치 후보가 여럿이면 사용자가 선택해요", async () => {
    const second = { ...milk, id: crypto.randomUUID() };
    editor(undefined, [milk, second]);
    fireEvent.change(screen.getByLabelText("품목 이름"), {
      target: { value: "우유" },
    });
    expect(
      screen.getByRole("button", { name: "기존 품목에 더하기" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("더할 품목 선택"), {
      target: { value: second.id },
    });
    fireEvent.change(screen.getByLabelText("단위"), {
      target: { value: milk.unit_id },
    });
    fireEvent.click(screen.getByRole("button", { name: "기존 품목에 더하기" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        action: "merge",
        id: second.id,
        delta: 1,
      }),
    );
  });
});

it("INV-01 P15.1b 보기에서 수정하면 삭제를 숨기고 취소·저장을 보여 줘요", async () => {
  editor(milk);
  fireEvent.click(screen.getByRole("button", { name: "품목 수정" }));
  expect(
    screen.queryByRole("button", { name: "품목 삭제" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "취소" })).toBeVisible();
  expect(screen.getByRole("button", { name: "저장" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("품목 이름"), {
    target: { value: "저지방 우유" },
  });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "save",
        id: milk.id,
        item: expect.objectContaining({ name: "저지방 우유" }),
      }),
    ),
  );
});

it.each([true, false])(
  "INV-04 CART-06 P15.1b 담기 표시 %s에서 하단 버튼 순서와 채움을 지켜요",
  (canAdd) => {
    editor({ ...milk, quantity: canAdd ? 0 : 999 });
    const used = screen.getByRole("button", { name: "다 썼어요" });
    const add = screen.queryByRole("button", {
      name: `${milk.name} 장바구니에 담기`,
    });
    expect(used.parentElement).toHaveClass(
      canAdd ? "grid-cols-2" : "grid-cols-1",
    );
    if (canAdd) {
      expect(used).toHaveClass("bg-muted");
      expect(add).toHaveClass("bg-primary");
      expect(add).toHaveTextContent("담기");
      expect(
        used.compareDocumentPosition(add!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    } else {
      expect(used).toHaveClass("bg-primary");
      expect(add).not.toBeInTheDocument();
    }
  },
);

it("INV-01 P15.1b 수정 취소는 품목 보기로 돌아가요", () => {
  editor(milk);
  fireEvent.click(screen.getByRole("button", { name: "품목 수정" }));
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.getByRole("button", { name: "품목 수정" })).toBeVisible();
  expect(screen.queryByLabelText("품목 이름")).not.toBeInTheDocument();
});
