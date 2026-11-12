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
import type * as CartItemModule from "@/entities/cart-item";
import type { CartItem } from "@/entities/cart-item";
import type { InventoryMeta } from "@/entities/inventory-item";
const state = vi.hoisted(() => ({ submit: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("@/entities/cart-item", async (importOriginal) => ({
  ...(await importOriginal<typeof CartItemModule>()),
  useCartActions: () => ({ mutateAsync: state.submit, isPending: false }),
}));
import RestockForm from "./Form";

const render = (ui: ReactElement) =>
  renderWithoutConfirm(ui, { wrapper: ConfirmProvider });
const meta = JSON.parse(
  readFileSync("mocks/inventory-meta.json", "utf8"),
) as InventoryMeta;
const items: CartItem[] = [0, 1].map((index) => ({
  id: crypto.randomUUID(),
  name: index ? "새두부" : "새 두부",
  quantity: index + 1,
  unit_id: meta.units[index]!.id,
  category_id: meta.categories[0]!.id,
  memo: "",
  link_url: "",
  added_by: null,
  checked_by: null,
  checked_at: null,
  is_checked: true,
  inventory_item_id: null,
  purchased_at: null,
  created_at: new Date().toISOString(),
}));
beforeEach(() => {
  state.submit.mockReset().mockResolvedValue({ results: [] });
  state.push.mockReset();
});
describe("CART-07 CART-08 SCN-CART-4 같은 이름 새 품목", () => {
  it("첫 품목에서만 단위와 장소를 정하고 나머지는 같은 단위로 수량만 보내요", async () => {
    render(
      <RestockForm
        items={items}
        inventory={[]}
        meta={meta}
        disabled={false}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByText("위 새 품목에 더함")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "새두부 단위" }),
    ).not.toBeInTheDocument();
    const unit = screen.getByRole("combobox", { name: "새 두부 단위" });
    fireEvent.change(unit, { target: { value: meta.units[2]!.id } });
    expect(
      screen.getByText(meta.units[2]!.name, { selector: "span" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("보관 장소"), {
      target: {
        value: meta.locations.find((location) => location.enabled)!.id,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "재고에 반영" }));
    await waitFor(() => expect(state.submit).toHaveBeenCalledOnce());
    const entries = state.submit.mock.calls[0]![0].entries;
    expect(entries.map((entry: { unit_id: string }) => entry.unit_id)).toEqual([
      meta.units[2]!.id,
      meta.units[2]!.id,
    ]);
    expect(
      entries.map((entry: { quantity: number }) => entry.quantity),
    ).toEqual([1, 2]);
    expect(entries[1].location_id).toBe(entries[0].location_id);
    expect(entries[1].category_id).toBe(entries[0].category_id);
  });
  it("SCN-CART-5 반영 없이 닫기는 시안 문구로 확인하고 쓰기를 보내지 않아요", async () => {
    render(
      <RestockForm
        items={items}
        inventory={[]}
        meta={meta}
        disabled={false}
        onDone={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "반영 없이 닫기" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "반영하지 않고 닫을까요?",
    );
    fireEvent.click(screen.getByRole("button", { name: /^닫기$/ }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/cart"));
    expect(state.submit).not.toHaveBeenCalled();
  });
});

it("CART-08 SCN-CART-4 P15.1b 선택한 유통기한을 비우면 null로 반영해요", async () => {
  render(
    <RestockForm
      items={[items[0]!]}
      inventory={[]}
      meta={meta}
      disabled={false}
      onDone={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /새 두부 유통기한/ }));
  fireEvent.click(await screen.findByRole("button", { name: "확인" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "새 두부 유통기한 지우기" }),
  );
  expect(
    screen.queryByRole("button", { name: "새 두부 유통기한 지우기" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("보관 장소"), {
    target: { value: meta.locations.find((location) => location.enabled)!.id },
  });
  fireEvent.click(screen.getByRole("button", { name: "재고에 반영" }));
  await waitFor(() => expect(state.submit).toHaveBeenCalledOnce());
  expect(state.submit.mock.calls[0]![0].entries[0].expires_on).toBeNull();
});
