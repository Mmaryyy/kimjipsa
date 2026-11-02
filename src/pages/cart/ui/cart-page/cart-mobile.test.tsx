import { readFileSync } from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem } from "@/entities/cart-item";
import type * as CartEntity from "@/entities/cart-item";
import type { InventoryMeta } from "@/entities/inventory-item";
import { ToastProvider } from "@/shared/ui";
import CartPage from ".";
const state = vi.hoisted(() => ({
  items: [] as CartItem[],
  write: vi.fn(),
  offline: false,
}));
const meta = JSON.parse(
  readFileSync("mocks/inventory-meta.json", "utf8"),
) as InventoryMeta;
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/entities/cart-item", async (original) => ({
  ...(await original<typeof CartEntity>()),
  useCart: () => ({
    data: { items: state.items, frequent: [], members: [] },
    offline: state.offline,
    syncedAt: 0,
  }),
  useCartActions: () => ({
    mutateAsync: state.write,
    pendingIds: [],
    isPending: false,
  }),
}));
vi.mock("@/entities/inventory-item", () => ({
  useInventoryMeta: () => ({ data: meta }),
  useInventory: () => ({ data: [] }),
  useInventoryActions: () => ({ meta: {} }),
}));
vi.mock("@/features/cart-add", () => ({
  useCartAdd: () => ({ pending: false }),
  CartDuplicateDialog: () => null,
}));
afterEach(cleanup);
beforeEach(() => {
  state.offline = false;
  state.items = ["달걀", "두부"].map((name) => ({
    id: crypto.randomUUID(),
    name,
    quantity: 2,
    unit_id: meta.units[0]!.id,
    category_id: meta.categories[0]!.id,
    memo: "",
    link_url: "",
    added_by: null,
    checked_by: null,
    is_checked: false,
    inventory_item_id: null,
    purchased_at: null,
    created_at: new Date().toISOString(),
  }));
  state.write.mockReset().mockImplementation(async (command) => {
    state.items = state.items.flatMap((item) => {
      if (command.action === "delete-selected" && command.ids.includes(item.id))
        return [];
      if (
        command.action === "clear-checked" &&
        item.is_checked &&
        command.ids.includes(item.id)
      )
        return [];
      if (item.id !== command.id) return [item];
      if (command.action === "delete") return [];
      if (command.action === "check")
        return [{ ...item, is_checked: command.checked }];
      if (command.action === "save") return [{ ...item, ...command.item }];
      return [item];
    });
    return { results: [] };
  });
});
const showCart = () =>
  render(
    <ToastProvider>
      <CartPage />
    </ToastProvider>,
  );
const editAndSelectAll = () => {
  fireEvent.click(screen.getByRole("button", { name: "편집" }));
  fireEvent.click(screen.getByRole("button", { name: "전체 선택" }));
};
describe("CART-03 CART-07 CART-13 CART-14 모바일 처리", () => {
  it("선택은 담음과 별개이며 전체 선택 후 담기는 편집을 끝내요", async () => {
    showCart();
    editAndSelectAll();
    expect(state.write).not.toHaveBeenCalled();
    expect(state.items.every((item) => !item.is_checked)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "선택 항목 담기" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "편집" })).toBeInTheDocument(),
    );
    expect(state.write).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "장바구니 구매 완료, 2개" }),
    ).toBeInTheDocument();
  });
  it("SCN-CART-4 구매 완료 줄은 담은 항목 바로 뒤에 있고 설정은 머리에 있어요", async () => {
    state.items[0]!.is_checked = true;
    const { container } = showCart();
    const checked = container.querySelector('[data-od-id="cart-checked"]');
    const purchase = container.querySelector('[data-od-id="cart-buy-bar"]');
    const manage = screen.getByRole("link", { name: "장바구니 카테고리 설정" });
    expect(checked?.nextElementSibling).toBe(purchase);
    expect(
      container.querySelector('[data-od-id="cart-header"]'),
    ).toContainElement(manage);
    expect(screen.queryByText("카테고리 관리하기")).not.toBeInTheDocument();
    expect(purchase).not.toHaveClass("fixed", "sticky");
    expect(
      screen.getByRole("button", { name: "장바구니 구매 완료, 1개" }),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", {
      name: "장바구니 구매 완료, 1개",
    });
    expect(within(button).getByText("1")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.queryByText("1개 담음")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(
      await screen.findByRole("dialog", { name: "재고 반영" }),
    ).toBeInTheDocument();
  });
  it("담은 항목이 없으면 구매 완료 줄을 숨겨요", () => {
    const { container } = showCart();
    expect(
      container.querySelector('[data-od-id="cart-buy-bar"]'),
    ).not.toBeInTheDocument();
  });
  it("일괄 처리 도중 실패하면 선택을 유지하고 남은 항목을 확인하게 해요", async () => {
    showCart();
    editAndSelectAll();
    state.write.mockRejectedValueOnce(new Error("연결이 끊겼어요"));
    fireEvent.click(screen.getByRole("button", { name: "선택 항목 담기" }));
    expect(
      await screen.findByText(
        "일부 항목만 처리됐을 수 있어요. 연결이 끊겼어요",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "전체 해제" }),
    ).toBeInTheDocument();
  });
  it("여러 항목 삭제는 확인하기 전에는 실행하지 않아요", async () => {
    showCart();
    editAndSelectAll();
    fireEvent.click(screen.getByRole("button", { name: "선택 항목 삭제" }));
    expect(state.write).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제하기" }));
    await waitFor(() => expect(state.write).toHaveBeenCalledOnce());
    expect(state.write).toHaveBeenCalledWith({
      action: "delete-selected",
      ids: expect.any(Array),
    });
    expect(state.items).toHaveLength(0);
  });
  it("한 항목은 키보드로 접근할 수 있는 편집 버튼에서 확인 없이 삭제해요", async () => {
    showCart();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    fireEvent.click(screen.getByRole("button", { name: "달걀 삭제" }));
    await waitFor(() => expect(state.write).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(state.items.map((item) => item.name)).toEqual(["두부"]);
  });
  it("SCN-CART-5 반영 없이 닫으면 새로 담은 항목만 원래대로 돌아가요", async () => {
    state.items[0]!.is_checked = true;
    showCart();
    editAndSelectAll();
    fireEvent.click(
      within(screen.getByRole("region", { name: "선택 항목 처리" })).getByRole(
        "button",
        { name: "선택 항목 구매 완료" },
      ),
    );
    expect(
      await screen.findByRole("dialog", { name: "재고 반영" }),
    ).toBeInTheDocument();
    expect(state.items.every((item) => item.is_checked)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "반영 없이 닫기" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "닫기",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      state.write.mock.calls.every(([command]) => command.action === "check"),
    ).toBe(true);
    expect(state.items.map((item) => item.is_checked)).toEqual([true, false]);
    expect(
      screen.getByRole("button", { name: "장바구니 구매 완료, 1개" }),
    ).toBeInTheDocument();
  });
  it("CART-13 담은 항목 하나도 일괄 삭제는 확인 후 한 번에 지워요", async () => {
    state.items[0]!.is_checked = true;
    showCart();
    fireEvent.click(screen.getByRole("button", { name: "일괄 삭제" }));
    expect(state.write).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "삭제하기",
      }),
    );
    await waitFor(() =>
      expect(state.write).toHaveBeenCalledWith({
        action: "clear-checked",
        ids: [expect.any(String)],
      }),
    );
    expect(state.items.map((item) => item.name)).toEqual(["두부"]);
  });
  it("CART-13 편집에서 한 개를 선택해 지우면 되돌릴 수 있어요", async () => {
    showCart();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "달걀 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 항목 삭제" }));
    expect(
      await screen.findByRole("button", { name: "되돌리기" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  it("수량만 변경해 저장하며 오프라인에서는 수정할 수 없어요", async () => {
    const view = showCart();
    fireEvent.click(screen.getByRole("button", { name: "달걀 수량 변경" }));
    fireEvent.click(screen.getByRole("button", { name: "달걀 늘리기" }));
    await waitFor(() =>
      expect(state.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "save",
          item: expect.objectContaining({ quantity: 3 }),
        }),
      ),
    );
    state.offline = true;
    view.rerender(
      <ToastProvider>
        <CartPage />
      </ToastProvider>,
    );
    expect(screen.getByRole("button", { name: "달걀 늘리기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "편집" })).toBeDisabled();
  });
});

describe("CART-07 INV-12 SCN-CART-4 반영 시트 되돌리기 토스트", () => {
  it.each([false, true])(
    "되돌리기 요청과 결과를 보여 줘요 (충돌: %s)",
    async (conflict) => {
      state.items.forEach((item) => {
        item.is_checked = true;
      });
      const token = crypto.randomUUID();
      state.write.mockImplementation(async (command) => {
        if (command.action === "restock")
          return {
            undoToken: token,
            results: state.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              status: "enough",
              unit_id: item.unit_id,
            })),
          };
        if (conflict) throw new Error("다른 변경이 있어 되돌릴 수 없어요.");
        return {};
      });
      showCart();
      fireEvent.click(
        screen.getByRole("button", { name: "장바구니 구매 완료, 2개" }),
      );
      await screen.findByRole("dialog", { name: "재고 반영" });
      for (const select of screen.getAllByLabelText("보관 장소"))
        fireEvent.change(select, {
          target: {
            value: meta.locations.find((location) => location.enabled)!.id,
          },
        });
      fireEvent.click(screen.getByRole("button", { name: "재고에 반영" }));
      const undo = await screen.findByRole("button", { name: "되돌리기" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      fireEvent.click(undo);
      await waitFor(() =>
        expect(state.write).toHaveBeenLastCalledWith({
          action: "undo-restock",
          token,
        }),
      );
      expect(
        await screen.findByText(
          conflict
            ? "다른 변경이 있어 되돌릴 수 없어요."
            : "재고 반영을 되돌렸어요",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "되돌리기" }),
      ).not.toBeInTheDocument();
    },
  );
});
