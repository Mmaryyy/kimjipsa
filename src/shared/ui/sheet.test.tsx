import { useState } from "react";
import {
  act,
  cleanup,
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

afterEach(async () => {
  cleanup();
  // 비동기 history.back 정리가 다음 시나리오의 시트에 섞이지 않게 기다린다.
  await new Promise((resolve) => setTimeout(resolve, 20));
  vi.unstubAllGlobals();
});

describe.each([true, false])("P15.1b Sheet 터치 여부 %s", (coarse) => {
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

  it.each(["Escape", "바깥"])(
    "%s 동작은 같은 닫힘 콜백을 한 번 호출해요",
    async (action) => {
      pointer(coarse);
      const onOpenChange = vi.fn();
      render(
        <Sheet open onOpenChange={onOpenChange} title="시트" description="설명">
          <button>내용 동작</button>
        </Sheet>,
      );
      const dialog = screen.getByRole("dialog", { name: "시트" });
      const close = within(dialog).queryByRole("button", { name: "닫기" });
      const focusTarget = dialog;
      await waitFor(() => expect(focusTarget).toHaveFocus());
      expect(close).not.toBeInTheDocument();
      if (action === "Escape")
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

  it("머리를 숨기면 제목을 접근성 이름으로만 제공해요", () => {
    pointer(coarse);
    render(
      <Sheet
        open
        hideHeader
        onOpenChange={vi.fn()}
        title="시트"
        description="설명"
      >
        내용
      </Sheet>,
    );
    const title = screen.getByRole("heading", { name: "시트" });
    expect(title.classList.contains("sr-only")).toBe(true);
    expect(document.querySelector("header")).toBeNull();
    expect(screen.queryByRole("button", { name: "닫기" }) !== null).toBe(false);
  });

  it("머리는 취소·제목·저장 순서이며 X가 없어요", () => {
    pointer(coarse);
    const onOpenChange = vi.fn();
    const save = vi.fn();
    render(
      <Sheet
        open
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

function NestedSheets() {
  const [open, setOpen] = useState(true);
  const [child, setChild] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="부모 시트"
      description="부모"
    >
      <button onClick={() => setChild(true)}>하위 시트 열기</button>
      <Sheet
        open={child && open}
        onOpenChange={setChild}
        title="하위 시트"
        description="하위"
      >
        <p>선택 내용</p>
      </Sheet>
    </Sheet>
  );
}
it.each(["Escape", "뒤로"])(
  "P15.1b 일반 시트도 %s로 하위만 닫고 뒤로가기로 부모를 닫아요",
  async (method) => {
    pointer(false);
    window.history.replaceState({}, "");
    render(<NestedSheets />);
    fireEvent.click(screen.getByRole("button", { name: "하위 시트 열기" }));
    expect(screen.getByRole("dialog", { name: "하위 시트" })).toBeVisible();
    if (method === "Escape")
      fireEvent.keyDown(screen.getByRole("dialog", { name: "하위 시트" }), {
        key: "Escape",
      });
    else act(() => window.history.back());
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "하위 시트" }),
      ).not.toBeInTheDocument(),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByRole("dialog", { name: "부모 시트" })).toBeVisible();
    act(() => window.history.back());
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
);

function ReplacedSheet() {
  const [step, setStep] = useState(0);
  return (
    <>
      <Sheet
        open={step === 0}
        onOpenChange={() => setStep(2)}
        title="품목 보기"
        description="품목"
      >
        <button onClick={() => setStep(1)}>다 썼어요</button>
      </Sheet>
      <Sheet
        open={step === 1}
        onOpenChange={() => setStep(2)}
        title="다 쓴 뒤"
        description="담기"
      >
        담을까요?
      </Sheet>
    </>
  );
}
it("P15.1b 시트를 교체한 뒤 닫으면 이전 시트의 기록도 남지 않아요", async () => {
  pointer(false);
  window.history.replaceState({}, "");
  render(<ReplacedSheet />);
  fireEvent.click(screen.getByRole("button", { name: "다 썼어요" }));
  expect(screen.getByRole("dialog", { name: "다 쓴 뒤" })).toBeVisible();
  act(() => window.history.back());
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(window.history.state?.formSheet).toBeUndefined());
});

it("P15.1b 데스크톱 폼의 명시적 autoFocus는 유지해요", async () => {
  pointer(false);
  render(
    <Sheet open onOpenChange={vi.fn()} title="입력 시트" description="설명">
      <button>첫 동작</button>
      <input aria-label="제목" autoFocus />
    </Sheet>,
  );
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "제목" })).toHaveFocus(),
  );
});
