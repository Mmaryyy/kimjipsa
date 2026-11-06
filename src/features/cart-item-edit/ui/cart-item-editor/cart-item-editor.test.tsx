import { readFileSync } from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as CartModule from "@/entities/cart-item";
import type { CartInput } from "@/entities/cart-item";
import type { InventoryMeta } from "@/entities/inventory-item";
const state = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/entities/cart-item", async (original) => ({
  ...(await original<typeof CartModule>()),
  useCartActions: () => ({ mutateAsync: state.save, isPending: false }),
}));
import CartItemEditor from ".";
const meta = JSON.parse(
  readFileSync("mocks/inventory-meta.json", "utf8"),
) as InventoryMeta;
const item: CartInput = {
  name: "휴지",
  quantity: 1,
  unit_id: null,
  category_id: null,
  memo: "",
  link_url: "",
  inventory_item_id: null,
};
afterEach(cleanup);
beforeEach(() => state.save.mockReset().mockResolvedValue({}));
describe("CART-05 SCN-CART-6 자주 사는 품목 편집", () => {
  it("이름과 수량 입력 없이 값과 숨김을 저장해요", async () => {
    const close = vi.fn();
    render(
      <CartItemEditor
        frequent
        item={item}
        meta={meta}
        disabled={false}
        onClose={close}
      />,
    );
    expect(screen.queryByLabelText("이름")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("수량")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("쇼핑몰 링크"), {
      target: { value: "https://example.com/item" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "목록에서 숨기기" }));
    fireEvent.click(screen.getAllByRole("button", { name: "저장" })[0]!);
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith({
        action: "save-frequent",
        item: expect.objectContaining({
          name: "휴지",
          hidden: true,
          link_url: "https://example.com/item",
        }),
      }),
    );
    expect(close).toHaveBeenCalledOnce();
  });
  it("숨김만 바꾸면 이름과 hidden만 보내요", async () => {
    render(
      <CartItemEditor
        frequent
        item={item}
        meta={meta}
        disabled={false}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "목록에서 숨기기" }));
    fireEvent.click(screen.getAllByRole("button", { name: "저장" })[0]!);
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith({
        action: "save-frequent",
        item: { name: "휴지", hidden: true },
      }),
    );
  });
  it("그대로 닫으면 저장하지 않고 잘못된 링크는 폼에서 막아요", async () => {
    const close = vi.fn();
    const view = render(
      <CartItemEditor
        frequent
        item={item}
        meta={meta}
        disabled={false}
        onClose={close}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(close).toHaveBeenCalledOnce();
    expect(state.save).not.toHaveBeenCalled();
    view.unmount();
    render(
      <CartItemEditor
        frequent
        item={item}
        meta={meta}
        disabled={false}
        onClose={close}
      />,
    );
    fireEvent.change(screen.getByLabelText("쇼핑몰 링크"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "저장" })[0]!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "http 또는 https",
    );
    expect(state.save).not.toHaveBeenCalled();
  });
});
