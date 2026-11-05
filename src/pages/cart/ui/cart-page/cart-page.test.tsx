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
  offline: false,
  saveUnit: vi.fn(),
  refetch: vi.fn(),
  add: vi.fn(),
}));
vi.mock("@/entities/cart-item", async (original) => ({
  ...(await original<typeof CartEntity>()),
  useCart: () => ({
    data: { items: [], frequent: [], members: [] },
    syncedAt: 0,
    offline: state.offline,
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
  state.offline = false;
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

describe("CART-05 CART-14 SCN-CART-6 기본 품목 추가", () => {
  it("기록이 없어도 네 품목을 보여 주고 기존 추가 경로로 수량 1을 담아요", () => {
    render(
      <ToastProvider>
        <CartPage />
      </ToastProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "자주 사는 품목" }),
    ).toBeInTheDocument();
    for (const name of ["휴지", "변기 세정제", "세탁세제", "생수"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(state.add).toHaveBeenLastCalledWith(
        expect.objectContaining({ name, quantity: 1 }),
      );
    }
    const form = document.querySelector('[data-od-id="cart-add-form"]')!;
    const frequent = document.querySelector('[data-od-id="cart-frequent"]')!;
    const list = document.querySelector('[data-od-id="cart-list"]')!;
    expect(
      form.compareDocumentPosition(frequent) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      frequent.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const submit = screen.getByRole("button", { name: "추가" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "항목 추가" }), {
      target: { value: "두부" },
    });
    expect(submit).toBeEnabled();
  });
  it("생수를 누르면 가정의 번들 단위와 12개입 설명으로 담아요", () => {
    state.units.push({ ...state.units[0]!, id: "bundle", name: "번들" });
    render(
      <ToastProvider>
        <CartPage />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "생수" }));
    expect(state.add).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "생수",
        quantity: 1,
        unit_id: "bundle",
        memo: "12개입",
      }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  it("기본 단위가 없으면 단위 없이 담고 확인창은 열지 않아요", () => {
    render(
      <ToastProvider>
        <CartPage />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "세탁세제" }));
    expect(state.add).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "세탁세제",
        quantity: 1,
        unit_id: null,
      }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(state.saveUnit).not.toHaveBeenCalled();
  });
  it("오프라인에서는 기본 품목과 직접 추가를 모두 막아요", () => {
    state.offline = true;
    render(
      <ToastProvider>
        <CartPage />
      </ToastProvider>,
    );
    for (const name of ["휴지", "변기 세정제", "세탁세제", "생수", "추가"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(state.add).not.toHaveBeenCalled();
  });
});
