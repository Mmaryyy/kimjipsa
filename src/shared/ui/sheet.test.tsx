import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "./sheet";

function pointer(coarse: boolean) {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(pointer: coarse)" && coarse,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe.each([true, false])("r127-f1 Sheet 터치 여부 %s", (coarse) => {
  it("기본으로 닫기 버튼을 표시하지 않아요", () => {
    pointer(coarse);
    render(
      <Sheet open onOpenChange={vi.fn()} title="시트" description="설명">
        내용
      </Sheet>,
    );
    expect(
      screen.queryByRole("button", { name: "닫기" }),
    ).not.toBeInTheDocument();
  });

  it.each(coarse ? ["Escape", "바깥"] : ["닫기", "Escape", "바깥"])(
    "%s 동작은 같은 닫힘 콜백을 한 번 호출해요",
    async (action) => {
      pointer(coarse);
      const onOpenChange = vi.fn();
      render(
        <Sheet
          open
          showCloseButton
          onOpenChange={onOpenChange}
          title="시트"
          description="설명"
        >
          <button>내용 동작</button>
        </Sheet>,
      );
      const dialog = screen.getByRole("dialog", { name: "시트" });
      const close = within(dialog).queryByRole("button", { name: "닫기" });
      const focusTarget = coarse
        ? dialog
        : within(dialog).getByRole("button", { name: "닫기" });
      await waitFor(() => expect(focusTarget).toHaveFocus());
      if (coarse) {
        expect(close).not.toBeInTheDocument();
      } else {
        expect(close).toBeVisible();
        expect(close?.querySelector("svg")).toBeInTheDocument();
      }
      if (action === "닫기") fireEvent.click(focusTarget);
      else if (action === "Escape")
        fireEvent.keyDown(focusTarget, { key: "Escape" });
      else {
        // Radix는 리스너를 다음 작업에 붙이고 바깥 누르기를 click까지 미뤄요.
        await new Promise((resolve) => setTimeout(resolve, 0));
        const overlay = document.querySelector(".kj-overlay");
        expect(overlay).toBeInTheDocument();
        fireEvent.pointerDown(overlay!, { button: 0 });
        fireEvent.pointerUp(overlay!, { button: 0 });
        fireEvent.click(overlay!, { button: 0 });
      }
      expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    },
  );

  it("머리를 숨기면 모바일은 닫기 버튼 설정과 관계없이 제목도 숨겨요", () => {
    pointer(coarse);
    render(
      <Sheet
        open
        hideHeader
        showCloseButton
        onOpenChange={vi.fn()}
        title="시트"
        description="설명"
      >
        내용
      </Sheet>,
    );
    const title = screen.getByRole("heading", { name: "시트" });
    expect(title.classList.contains("sr-only")).toBe(coarse);
    expect(document.querySelector("header") !== null).toBe(!coarse);
    expect(screen.queryByRole("button", { name: "닫기" }) !== null).toBe(
      !coarse,
    );
  });

  it("취소 슬롯과 저장 동작은 X와 별도로 유지해요", () => {
    pointer(coarse);
    const onOpenChange = vi.fn();
    const save = vi.fn();
    render(
      <Sheet
        open
        showCloseButton
        onOpenChange={onOpenChange}
        title="시트"
        description="설명"
        leadingAction={(onChange) => (
          <button onClick={() => onChange(false)}>취소</button>
        )}
        action={<button onClick={save}>저장</button>}
      >
        내용
      </Sheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(save).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });
});

it("r184 키보드가 닫힌 뒤 늦게 복구된 viewport와 시트 여백을 반영해요", async () => {
  pointer(true);
  const viewport = new EventTarget();
  let height = 400;
  let offsetTop = 0;
  Object.defineProperties(viewport, {
    height: { get: () => height },
    offsetTop: { get: () => offsetTop },
  });
  vi.stubGlobal("visualViewport", viewport);
  const { unmount } = render(
    <Sheet open title="키보드 시트" description="설명" onOpenChange={vi.fn()}>
      <input aria-label="제목" />
    </Sheet>,
  );
  const dialog = screen.getByRole("dialog", { name: "키보드 시트" });
  await waitFor(() =>
    expect(dialog.style.bottom).toBe(`${window.innerHeight - height}px`),
  );
  expect(screen.getByRole("textbox").parentElement).toHaveClass(
    "-mx-4",
    "px-4",
  );
  vi.useFakeTimers();
  try {
    fireEvent.focusOut(screen.getByRole("textbox"));
    height = window.innerHeight;
    offsetTop = -60;
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(dialog.style.bottom).toBe("0px");
    expect(dialog.style.getPropertyValue("--drawer-viewport-height")).toBe("");
    unmount();
  } finally {
    vi.useRealTimers();
  }
});
