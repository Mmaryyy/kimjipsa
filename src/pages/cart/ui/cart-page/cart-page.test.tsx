import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CartPage from ".";
import type * as CartEntity from "@/entities/cart-item";
import { ToastProvider } from "@/shared/ui";
const state = vi.hoisted(() => ({
  units: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: "개",
      enabled: true,
      sort_order: 0,
      icon_kind: null,
      icon_value: "",
    },
  ],
  saveUnit: vi.fn(),
  refetch: vi.fn(),
  add: vi.fn(),
}));
vi.mock("@/entities/cart-item", async (original) => ({
  ...(await original<typeof CartEntity>()),
  useCart: () => ({
    data: { items: [], frequent: [], members: [] },
    syncedAt: 0,
  }),
  useCartActions: () => ({ pendingIds: [] }),
}));
vi.mock("@/entities/inventory-item", () => ({
  useInventoryMeta: () => ({
    data: { units: state.units, categories: [] },
    refetch: state.refetch,
  }),
  useInventoryActions: () => ({ meta: { mutateAsync: state.saveUnit } }),
}));
vi.mock("@/features/cart-add", () => ({
  useCartAdd: () => ({ onAdd: state.add, pending: false }),
  CartDuplicateDialog: () => null,
}));
afterEach(cleanup);
beforeEach(() => {
  state.units.splice(1);
  state.saveUnit.mockReset().mockImplementation(async (command) => {
    if (command.id)
      Object.assign(
        state.units.find((unit) => unit.id === command.id)!,
        command.entry,
      );
    else
      state.units.push({
        ...command.entry,
        id: "00000000-0000-4000-8000-000000000002",
      });
  });
  state.refetch
    .mockReset()
    .mockImplementation(async () => ({ data: { units: state.units } }));
  state.add.mockReset().mockResolvedValue(true);
});
function add(value: string) {
  render(
    <ToastProvider>
      <CartPage />
    </ToastProvider>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "항목 추가" }), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "추가" }));
}
describe("CART-01 CART-12 빠른 추가 단위 확인", () => {
  it("수량 0은 단위를 만들기 전에 막아요", () => {
    add("두부 0모");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(state.saveUnit).not.toHaveBeenCalled();
    expect(state.add).not.toHaveBeenCalled();
    expect(screen.getByText("수량은 0보다 커야 해요.")).toBeInTheDocument();
  });
  it("단위를 만들고 다시 조회한 id로 담기를 요청해요", async () => {
    add("두부 2모");
    fireEvent.click(screen.getByRole("button", { name: "단위 추가" }));
    await waitFor(() =>
      expect(state.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "두부",
          quantity: 2,
          unit_id: "00000000-0000-4000-8000-000000000002",
        }),
      ),
    );
    expect(state.saveUnit).toHaveBeenCalledTimes(1);
    expect(state.refetch).toHaveBeenCalledTimes(2);
  });
  it("대소문자가 다른 비활성 단위는 새로 만들지 않고 다시 켜요", async () => {
    state.units.push({
      ...state.units[0]!,
      id: "00000000-0000-4000-8000-000000000002",
      name: "kg",
      enabled: false,
    });
    add("쌀 2KG");
    fireEvent.click(screen.getByRole("button", { name: "단위 추가" }));
    await waitFor(() =>
      expect(state.add).toHaveBeenCalledWith(
        expect.objectContaining({
          unit_id: "00000000-0000-4000-8000-000000000002",
        }),
      ),
    );
    expect(state.saveUnit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000002",
        entry: expect.objectContaining({ enabled: true }),
      }),
    );
    expect(state.units).toHaveLength(2);
  });
  it("단위 생성 실패는 담지 않고 확인창에서 다시 시도하게 해요", async () => {
    state.saveUnit.mockRejectedValue(new Error("단위 저장 실패"));
    add("두부 2모");
    fireEvent.click(screen.getByRole("button", { name: "단위 추가" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "단위 저장 실패",
    );
    expect(state.add).not.toHaveBeenCalled();
  });
});
