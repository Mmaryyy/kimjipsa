import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEditorSheet } from "./event-editor-sheet";
import { EventDateTimeSheet } from "./event-date-time-sheet";

function Editor() {
  const [open, setOpen] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [wheel, setWheel] = useState(false);
  return (
    <EventEditorSheet
      open={open}
      onOpenChange={setOpen}
      dirty={dirty}
      title="새 일정"
      description="일정 입력"
      closeLabel="취소"
    >
      <input aria-label="제목" onChange={() => setDirty(true)} />
      <button id="dates" onClick={() => setWheel(true)}>
        날짜 선택
      </button>
      {wheel && (
        <EventDateTimeSheet
          range={{
            startDate: "2026-10-21",
            endDate: "2026-10-21",
            startTime: "09:00",
            endTime: "10:00",
          }}
          initialTab="end"
          dateOnly={false}
          singleDate={false}
          onConfirm={() => setWheel(false)}
          onClose={() => setWheel(false)}
          onRestoreFocus={() => document.getElementById("dates")?.focus()}
        />
      )}
    </EventEditorSheet>
  );
}
function pointer(coarse: boolean) {
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
describe("CAL-01 CAL-02 SCN-CAL-1 P5.5 일정 폼 오버레이", () => {
  it.each([true, false])(
    "터치 여부 %s에 맞게 열고 변경 없는 취소는 바로 닫아요",
    (coarse) => {
      pointer(coarse);
      render(<Editor />);
      const dialog = screen.getByRole("dialog", { name: "새 일정" });
      expect(dialog.hasAttribute("data-vaul-drawer")).toBe(coarse);
      if (coarse)
        expect(
          dialog.querySelector('[aria-hidden="true"]'),
        ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "취소" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
  it.each([true, false])(
    "터치 여부 %s에서 변경 후 닫기는 확인하고 취소하면 입력을 유지해요",
    async (coarse) => {
      pointer(coarse);
      render(<Editor />);
      fireEvent.change(screen.getByLabelText("제목"), {
        target: { value: "약속" },
      });
      fireEvent.click(screen.getByRole("button", { name: "취소" }));
      expect(screen.getByRole("alertdialog")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
      expect(screen.getByLabelText("제목")).toHaveValue("약속");
      fireEvent.click(screen.getByRole("button", { name: "취소" }));
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    },
  );
  it("Drawer 위 휠은 ESC로 휠만 닫고 연 행으로 포커스가 돌아와요", async () => {
    pointer(true);
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "날짜 선택" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "종료" })).toHaveFocus(),
    );
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "날짜 선택" })).toHaveFocus(),
    );
    expect(screen.getByRole("dialog", { name: "새 일정" })).toBeVisible();
    expect(
      screen.queryByRole("dialog", { name: "날짜와 시간 선택" }),
    ).not.toBeInTheDocument();
  });
});
