import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePullToAdd } from "./use-pull-to-add";

const Example = ({
  onAdd,
  disabled = false,
}: {
  onAdd: () => void;
  disabled?: boolean;
}) => {
  const { ref, distance, ready } = usePullToAdd(onAdd, disabled);
  return (
    <div ref={ref} data-testid="surface">
      <input aria-label="입력" />
      <span data-ready={ready}>
        {distance ? "당겨서 일정 등록하기" : "대기"}
      </span>
    </div>
  );
};
const touch = (x: number, y: number) => ({
  clientX: x,
  clientY: y,
  identifier: 1,
});
function pull(x: number, y: number) {
  const root = screen.getByTestId("surface");
  fireEvent.touchStart(root, { touches: [touch(0, 0)] });
  fireEvent.touchMove(root, { touches: [touch(x, y)] });
  fireEvent.touchEnd(root, { touches: [] });
}
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal("scrollY", 0);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CAL-01 INV-01 CART-01 P11.3 당겨서 일정 등록하기", () => {
  it.each([
    [0, 71, 0],
    [0, 72, 1],
    [100, 80, 0],
    [0, -80, 0],
  ])("이동 %i,%i 뒤 등록 횟수 %i", (x, y, calls) => {
    const onAdd = vi.fn();
    render(<Example onAdd={onAdd} />);
    pull(x, y);
    expect(onAdd).toHaveBeenCalledTimes(calls);
    expect(screen.getByText("대기")).toBeVisible();
  });
  it.each(["scroll", "dialog", "disabled", "input", "mouse", "nested"])(
    "%s 상태는 무시해요",
    (mode) => {
      if (mode === "scroll") vi.stubGlobal("scrollY", 20);
      if (mode === "mouse")
        vi.mocked(window.matchMedia).mockReturnValue({
          ...window.matchMedia("(pointer: coarse)"),
          matches: false,
        });
      const onAdd = vi.fn();
      render(
        <>
          <Example onAdd={onAdd} disabled={mode === "disabled"} />
          {mode === "dialog" && <div role="dialog" />}
        </>,
      );
      if (mode === "input") screen.getByRole("textbox").focus();
      if (mode === "nested") screen.getByTestId("surface").scrollTop = 10;
      pull(0, 100);
      expect(onAdd).not.toHaveBeenCalled();
    },
  );
  it("안내는 유지하고 임계 전으로 돌아오거나 취소하면 열지 않아요", () => {
    const onAdd = vi.fn();
    render(<Example onAdd={onAdd} />);
    const root = screen.getByTestId("surface");
    fireEvent.touchStart(root, { touches: [touch(0, 0)] });
    fireEvent.touchMove(root, { touches: [touch(0, 40)] });
    expect(screen.getByText("당겨서 일정 등록하기")).toHaveAttribute(
      "data-ready",
      "false",
    );
    fireEvent.touchMove(root, { touches: [touch(0, 90)] });
    expect(screen.getByText("당겨서 일정 등록하기")).toHaveAttribute(
      "data-ready",
      "true",
    );
    fireEvent.touchMove(root, { touches: [touch(0, 3)] });
    fireEvent.touchEnd(root, { touches: [] });
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.touchStart(root, { touches: [touch(0, 0)] });
    fireEvent.touchMove(root, { touches: [touch(0, 90)] });
    fireEvent.touchCancel(root);
    fireEvent.touchEnd(root, { touches: [] });
    expect(onAdd).not.toHaveBeenCalled();
  });
  it("드래그 도중 시트가 열리면 등록하지 않고 overscroll은 해제 때 복원해요", () => {
    const onAdd = vi.fn();
    const { rerender, unmount } = render(<Example onAdd={onAdd} />);
    const root = screen.getByTestId("surface");
    fireEvent.touchStart(root, { touches: [touch(0, 0)] });
    fireEvent.touchMove(root, { touches: [touch(0, 90)] });
    rerender(<Example onAdd={onAdd} disabled />);
    fireEvent.touchEnd(root, { touches: [] });
    expect(onAdd).not.toHaveBeenCalled();
    expect(document.documentElement.style.overscrollBehaviorY).toBe("none");
    unmount();
    expect(document.documentElement.style.overscrollBehaviorY).not.toBe("none");
  });
});
