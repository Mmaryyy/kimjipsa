import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));
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
