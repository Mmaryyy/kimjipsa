import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartItem } from "@/entities/cart-item";
import CartItemRow from "./Row";
const item: CartItem = {
  id: crypto.randomUUID(),
  name: "두부",
  quantity: 1,
  unit_id: null,
  category_id: null,
  memo: "찌개용으로 골라 주세요",
  link_url: "",
  inventory_item_id: null,
  added_by: null,
  checked_by: null,
  is_checked: false,
  purchased_at: null,
  created_at: new Date().toISOString(),
};
const SwipeExample = ({
  onDelete,
  onPurchase = vi.fn(),
  onCheck = vi.fn(),
  onEdit = vi.fn(),
  onQuantityChange = vi.fn(),
}: {
  onDelete: () => void;
  onPurchase?: () => void;
  onCheck?: () => void;
  onEdit?: () => void;
  onQuantityChange?: (quantity: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <CartItemRow
      item={item}
      index={0}
      unit="모"
      checkedBy="나"
      open={open}
      disabled={false}
      pending={false}
      onOpenChange={setOpen}
      onPurchase={onPurchase}
      onQuantityChange={onQuantityChange}
      onCheck={onCheck}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
};
const pointer = (row: HTMLElement, type: string, x: number, y: number) => {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, {
    clientX: x,
    clientY: y,
    isPrimary: true,
    pointerId: 1,
    button: 0,
  });
  fireEvent(row, event);
};
afterEach(cleanup);
describe("CART-13 스와이프 제스처", () => {
  it("가로 스와이프 뒤 클릭은 무시하고 다음 삭제 버튼 누르기는 실행해요", () => {
    const onDelete = vi.fn();
    render(<SwipeExample onDelete={onDelete} />);
    const row = screen.getByRole("listitem");
    row.setPointerCapture = vi.fn();
    expect(
      screen.queryByRole("button", { name: "두부 삭제" }),
    ).not.toBeInTheDocument();
    pointer(row, "pointerdown", 300, 30);
    pointer(row, "pointermove", 100, 30);
    // Touch capture moves from the child hit target to the row while dragging.
    pointer(
      screen.getByRole("button", { name: "두부 수량 변경" }),
      "lostpointercapture",
      100,
      30,
    );
    pointer(row, "pointerup", 100, 30);
    const remove = screen.getByRole("button", { name: "두부 삭제" });
    fireEvent.click(remove);
    expect(onDelete).not.toHaveBeenCalled();
    pointer(row, "pointerdown", 330, 30);
    pointer(row, "pointerup", 330, 30);
    fireEvent.click(remove);
    expect(onDelete).toHaveBeenCalledOnce();
  });
  it("품목 이름으로 아이콘 구매 완료 버튼을 찾고 누르며 오른쪽 스와이프로 닫아요", () => {
    const onPurchase = vi.fn();
    render(<SwipeExample onDelete={vi.fn()} onPurchase={onPurchase} />);
    const row = screen.getByRole("listitem");
    row.setPointerCapture = vi.fn();
    pointer(row, "pointerdown", 300, 30);
    pointer(row, "pointermove", 100, 30);
    pointer(row, "pointerup", 100, 30);
    const purchase = screen.getByRole("button", { name: "두부 구매 완료" });
    expect(purchase.textContent).toBe("");
    expect(purchase.querySelector("svg")).not.toBeNull();
    const remove = screen.getByRole("button", { name: "두부 삭제" });
    expect(remove.textContent).toBe("");
    expect(remove.querySelector("svg")).not.toBeNull();
    pointer(row, "pointerdown", 280, 30);
    pointer(row, "pointerup", 280, 30);
    fireEvent.click(purchase);
    expect(onPurchase).toHaveBeenCalledOnce();
    pointer(row, "pointerdown", 100, 30);
    pointer(row, "pointermove", 220, 30);
    pointer(row, "pointerup", 220, 30);
    expect(
      screen.queryByRole("button", { name: "두부 구매 완료" }),
    ).not.toBeInTheDocument();
    expect(remove.parentElement).toHaveAttribute("inert");
  });
  it("드래그 중에도 항목을 밀지 않고 버튼 공간만 확보하며 열린 동안 수정을 막아요", () => {
    const onCheck = vi.fn();
    const onEdit = vi.fn();
    render(
      <SwipeExample onDelete={vi.fn()} onCheck={onCheck} onEdit={onEdit} />,
    );
    const row = screen.getByRole("listitem");
    row.setPointerCapture = vi.fn();
    const checkbox = screen.getByRole("checkbox", { name: "두부 담음" });
    const name = screen.getByRole("button", { name: "두부" });
    const quantity = screen.getByRole("button", { name: "두부 수량 변경" });
    const content = checkbox.parentElement;
    pointer(row, "pointerdown", 300, 30);
    pointer(row, "pointermove", 260, 30);
    expect(content).toHaveStyle({ paddingRight: "40px" });
    expect(content?.style.transform).toBe("");
    expect(checkbox).toBeVisible();
    expect(checkbox).toBeDisabled();
    expect(name).toBeVisible();
    expect(name).toBeDisabled();
    expect(quantity).toBeVisible();
    expect(quantity).toBeDisabled();
    expect(screen.getByText(item.memo)).toBeVisible();
    pointer(row, "pointermove", 100, 30);
    pointer(row, "pointerup", 100, 30);
    expect(content).toHaveStyle({ paddingRight: "96px" });
    expect(content?.style.transform).toBe("");
    fireEvent.click(name);
    fireEvent.click(checkbox);
    fireEvent.click(quantity);
    expect(onEdit).not.toHaveBeenCalled();
    expect(onCheck).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("group", { name: "두부" }),
    ).not.toBeInTheDocument();
    pointer(row, "pointerdown", 100, 30);
    pointer(row, "pointermove", 220, 30);
    pointer(row, "pointerup", 220, 30);
    expect(content).toHaveStyle({ paddingRight: "0px" });
    expect(checkbox).toBeEnabled();
    expect(name).toBeEnabled();
    expect(quantity).toBeEnabled();
  });
  it("수량 조절 중 스와이프를 열어도 증감과 직접 입력을 막아요", () => {
    const onQuantityChange = vi.fn();
    render(
      <SwipeExample onDelete={vi.fn()} onQuantityChange={onQuantityChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "두부 수량 변경" }));
    const row = screen.getByRole("listitem");
    row.setPointerCapture = vi.fn();
    pointer(row, "pointerdown", 300, 30);
    pointer(row, "pointermove", 100, 30);
    pointer(row, "pointerup", 100, 30);
    const increase = screen.getByRole("button", { name: "두부 늘리기" });
    expect(increase).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "두부 수량 직접 입력" }),
    ).toBeDisabled();
    fireEvent.click(increase);
    expect(onQuantityChange).not.toHaveBeenCalled();
  });
  it("세로 스크롤과 취소한 제스처는 동작 버튼을 열지 않아요", () => {
    render(<SwipeExample onDelete={vi.fn()} />);
    const row = screen.getByRole("listitem");
    row.setPointerCapture = vi.fn();
    pointer(row, "pointerdown", 300, 30);
    pointer(row, "pointermove", 296, 60);
    pointer(row, "pointerup", 296, 60);
    expect(
      screen.queryByRole("button", { name: "두부 삭제" }),
    ).not.toBeInTheDocument();
    pointer(row, "pointerdown", 300, 30);
    pointer(row, "pointermove", 100, 30);
    pointer(row, "pointercancel", 100, 30);
    expect(
      screen.queryByRole("button", { name: "두부 삭제" }),
    ).not.toBeInTheDocument();
  });
});
