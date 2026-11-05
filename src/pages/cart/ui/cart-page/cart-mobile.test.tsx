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
    checked_at: null,
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
describe("CART-03 CART-07 CART-13 CART-14 제자리 처리", () => {
  it("체크해도 원래 행을 유지하며 처리 개수가 바뀌고 해제하면 숨겨요", async () => {
    const view = showCart();
    const row = screen
      .getByRole("checkbox", { name: "달걀 담음" })
      .closest("li");
    expect(
      screen.queryByRole("button", { name: /구매 완료/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "달걀 담음" }));
    await waitFor(() => expect(state.write).toHaveBeenCalledOnce());
    view.rerender(
      <ToastProvider>
        <CartPage />
      </ToastProvider>,
    );
    expect(screen.getByRole("button", { name: "구매 완료(1)" })).toBeVisible();
    const actions = document.querySelector('[data-od-id="cart-actions"]')!;
    expect(actions).toHaveAttribute("data-cart-actions-visible", "true");
    expect(actions).not.toHaveAttribute("inert");
    expect(
      screen.getByRole("checkbox", { name: "달걀 담음" }).closest("li"),
    ).toBe(row);
    expect(screen.queryByText("담은 항목")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "편집" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "달걀 담음" }));
    await waitFor(() => expect(state.write).toHaveBeenCalledTimes(2));
    view.rerender(
      <ToastProvider>
        <CartPage />
      </ToastProvider>,
    );
    expect(
      screen.queryByRole("button", { name: /구매 완료/ }),
    ).not.toBeInTheDocument();
    expect(actions).toHaveAttribute("data-cart-actions-visible", "false");
    expect(actions).toHaveAttribute("inert");
    expect(actions).toHaveAttribute("aria-hidden", "true");
  });
  it("SCN-CART-5 반영 없이 닫으면 체크를 유지해요", async () => {
    state.items[0]!.is_checked = true;
    showCart();
    fireEvent.click(screen.getByRole("button", { name: "구매 완료(1)" }));
    await screen.findByRole("dialog", { name: "재고 반영" });
    fireEvent.click(screen.getByRole("button", { name: "반영 없이 닫기" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "닫기",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(state.write).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "달걀 담음" })).toBeChecked();
  });
  it.each([1, 2])(
    "CART-13 체크 %s개 삭제도 확인 후 실행해요",
    async (count) => {
      state.items.slice(0, count).forEach((item) => {
        item.is_checked = true;
      });
      showCart();
      fireEvent.click(screen.getByRole("button", { name: "삭제" }));
      expect(state.write).not.toHaveBeenCalled();
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "취소하기",
        }),
      );
      expect(state.write).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "삭제" }));
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "삭제하기",
        }),
      );
      await waitFor(() =>
        expect(state.write).toHaveBeenCalledWith({
          action: "clear-checked",
          ids: expect.any(Array),
        }),
      );
      expect(state.items).toHaveLength(2 - count);
    },
  );
  it("수량만 변경해 저장해요", async () => {
    showCart();
    fireEvent.click(
      screen.getByRole("button", { name: "달걀 수량 2개, 눌러서 바꾸기" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "달걀 늘리기" }));
    await waitFor(() =>
      expect(state.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "save",
          item: expect.objectContaining({ quantity: 3 }),
        }),
      ),
    );
  });
  it("CART-01 수량을 펼쳐 직접 입력하고 다른 항목이나 Esc로 접어요", async () => {
    showCart();
    const quantity = () =>
      screen.getByRole("button", { name: /달걀 수량 .*눌러서 바꾸기/ });
    expect(quantity()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(quantity());
    expect(screen.getByRole("button", { name: "달걀 늘리기" })).toHaveFocus();
    fireEvent.click(
      screen.getByRole("button", { name: "달걀 수량 직접 입력" }),
    );
    const input = screen.getByRole("textbox", { name: "달걀 수량" });
    fireEvent.change(input, { target: { value: "3.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(state.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "save",
          item: expect.objectContaining({ quantity: 3.5 }),
        }),
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /두부 수량 .*눌러서 바꾸기/ }),
    );
    expect(quantity()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "두부 늘리기" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: /두부 수량 .*눌러서 바꾸기/ }),
    ).toHaveAttribute("aria-expanded", "false");
  });
  it("오프라인에서는 수량과 처리를 막아요", () => {
    state.items[0]!.is_checked = true;
    state.offline = true;
    showCart();
    expect(
      screen.getByRole("button", { name: "달걀 수량 2개, 눌러서 바꾸기" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "구매 완료(1)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "삭제" })).toBeDisabled();
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
        if (command.action === "restock") {
          const purchased = [...state.items];
          state.items = [];
          return {
            undoToken: token,
            results: purchased.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              status: "enough",
              unit_id: item.unit_id,
            })),
          };
        }
        if (conflict) throw new Error("다른 변경이 있어 되돌릴 수 없어요.");
        return {};
      });
      showCart();
      fireEvent.click(screen.getByRole("button", { name: "구매 완료(2)" }));
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
      expect(
        screen.queryByRole("checkbox", { name: "달걀 담음" }),
      ).not.toBeInTheDocument();
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
