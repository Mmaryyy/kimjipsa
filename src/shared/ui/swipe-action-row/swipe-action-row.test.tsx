import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SwipeActionRow from ".";
import { ConfirmTestProvider } from "../confirm-test-provider";
import { useConfirm } from "../confirm-context";
import { Button } from "../button";

const pointer = (row: HTMLElement, type: string, x: number, y = 30) => {
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
const example = (label = "두부", count = 2) => (
  <SwipeActionRow
    label={`${label} 동작`}
    actions={Array.from({ length: count }, (_, i) => (
      <Button key={i} aria-label={`${label} 동작 ${i}`}>
        동작
      </Button>
    ))}
  >
    {(disabled) => <Button disabled={disabled}>{label}</Button>}
  </SwipeActionRow>
);
const swipe = (row: HTMLElement, distance: number, end = "pointerup") => {
  row.setPointerCapture = vi.fn();
  pointer(row, "pointerdown", 300);
  pointer(row, "pointermove", 300 - distance);
  pointer(row, end, 300 - distance);
};
afterEach(cleanup);
describe("CART-13 INV-15 CAL-05 P15.1c 공용 행 밀기", () => {
  it.each([11, 60, 61])("%spx 이동은 60px을 넘을 때만 열어요", (distance) => {
    render(example());
    swipe(screen.getByRole("listitem"), distance);
    expect(screen.queryByRole("button", { name: "두부 동작 0" }) !== null).toBe(
      distance > 60,
    );
  });
  it("버튼 수로 폭을 정하고 키보드로 한 행만 열며 본문을 비활성화해요", () => {
    render(
      <ul>
        {example()}
        {example("우유", 3)}
      </ul>,
    );
    const rows = screen.getAllByRole("listitem");
    fireEvent.keyDown(rows[0], { key: "ArrowLeft" });
    expect(screen.getByRole("button", { name: "두부" })).toBeDisabled();
    expect(rows[0].querySelector("[data-swipe-content]")).toHaveStyle({
      paddingRight: "96px",
    });
    fireEvent.keyDown(rows[1], { key: "ArrowLeft" });
    expect(screen.queryByRole("button", { name: "두부 동작 0" })).toBeNull();
    expect(screen.getByRole("button", { name: "우유 동작 2" })).toBeVisible();
    expect(rows[1].querySelector("[data-swipe-content]")).toHaveStyle({
      paddingRight: "144px",
    });
    fireEvent.keyDown(rows[1], { key: "ArrowRight" });
    expect(screen.queryByRole("button", { name: "우유 동작 2" })).toBeNull();
  });
  it.each(["pointercancel", "lostpointercapture"])(
    "%s는 닫고 세로 이동도 열지 않아요",
    (end) => {
      render(example());
      const row = screen.getByRole("listitem");
      swipe(row, 100, end);
      expect(screen.queryByRole("button", { name: "두부 동작 0" })).toBeNull();
      pointer(row, "pointerdown", 300);
      pointer(row, "pointermove", 295, 80);
      pointer(row, "pointerup", 200, 80);
      expect(screen.queryByRole("button", { name: "두부 동작 0" })).toBeNull();
    },
  );
  it.each(["outside", "scroll", "Escape"])("%s로 닫아요", (action) => {
    render(example());
    fireEvent.keyDown(screen.getByRole("listitem"), { key: "ArrowLeft" });
    if (action === "outside") fireEvent.pointerDown(document.body);
    else if (action === "scroll") fireEvent.scroll(document);
    else fireEvent.keyDown(document, { key: action });
    expect(screen.queryByRole("button", { name: "두부 동작 0" })).toBeNull();
  });
  it("비활성 행은 밀기와 키보드로 열리지 않아요", () => {
    render(
      <SwipeActionRow
        label="잠긴 행"
        disabled
        actions={[<Button key="delete">삭제</Button>]}
      >
        {() => "행"}
      </SwipeActionRow>,
    );
    const row = screen.getByRole("listitem");
    swipe(row, 100);
    fireEvent.keyDown(row, { key: "ArrowLeft" });
    expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
  });
});

it("CART-13 행 내용은 이름으로 가리지 않고 키보드 사용법을 안내해요", () => {
  render(example());
  const row = screen.getByRole("listitem");
  expect(row).not.toHaveAttribute("aria-label");
  expect(row).toHaveAccessibleDescription(/왼쪽 화살표 키/);
});
it("CART-13 Escape와 외부 제어로 닫으면 동작 버튼의 포커스를 행으로 돌려요", () => {
  const { rerender } = render(example());
  const row = screen.getByRole("listitem");
  fireEvent.keyDown(row, { key: "ArrowLeft" });
  screen.getByRole("button", { name: "두부 동작 0" }).focus();
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(row).toHaveFocus();
  const controlled = (open: boolean) => (
    <SwipeActionRow
      label="동작"
      open={open}
      actions={[<Button key="a">삭제</Button>]}
    >
      {() => "행 내용"}
    </SwipeActionRow>
  );
  rerender(controlled(true));
  screen.getByRole("button", { name: "삭제" }).focus();
  rerender(controlled(false));
  expect(screen.getByRole("listitem")).toHaveFocus();
});
it("CART-13 부모 콜백이 바뀌어도 열린 행 이벤트를 다시 보내지 않아요", () => {
  const opened = vi.fn();
  document.addEventListener("swipe-row-open", opened);
  const view = () => (
    <SwipeActionRow label="동작" open onOpenChange={() => {}} actions={[]}>
      {() => "행 내용"}
    </SwipeActionRow>
  );
  const { rerender } = render(view());
  rerender(view());
  expect(opened).toHaveBeenCalledTimes(1);
  document.removeEventListener("swipe-row-open", opened);
});
const ConfirmRow = () => {
  const confirm = useConfirm();
  return (
    <SwipeActionRow
      label="두부 동작"
      actions={[
        <Button
          key="delete"
          onClick={() =>
            void confirm({ title: "삭제할까요?", description: "삭제 확인" })
          }
        >
          삭제
        </Button>,
      ]}
    >
      {(disabled) => <Button disabled={disabled}>두부</Button>}
    </SwipeActionRow>
  );
};
it.each(["Escape", "cancel"])(
  "INV-07 확인창 %s 후 포커스를 행에 유지해요",
  async (action) => {
    render(<ConfirmRow />, { wrapper: ConfirmTestProvider });
    const row = screen.getByRole("listitem");
    fireEvent.keyDown(row, { key: "ArrowLeft" });
    const button = screen.getByRole("button", { name: "삭제" });
    button.focus();
    fireEvent.click(button);
    if (action === "Escape")
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    else {
      fireEvent.pointerDown(screen.getByRole("button", { name: "취소하기" }));
      fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(row).toHaveFocus();
  },
);
