import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

function DialogExample({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      targetName="저녁 약속"
      title="일정을 삭제할까요?"
      description="삭제한 일정은 되돌릴 수 없어요"
      onConfirm={onConfirm}
    />
  );
}

describe("CAL-12 SCN-CAL-7 ConfirmDialog 확인 UI", () => {
  it("대상 이름이 포함된 제목을 보여 줘요", () => {
    render(<DialogExample onConfirm={vi.fn()} />);
    expect(
      screen.getByRole("alertdialog", {
        name: "‘저녁 약속’ 일정을 삭제할까요?",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "‘저녁 약속’ 일정을 삭제할까요?" }),
    ).toBeVisible();
  });

  it("취소하면 닫히고 확인 콜백을 호출하지 않아요", () => {
    const onConfirm = vi.fn();
    render(<DialogExample onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("확인하면 확인 콜백을 호출해요", () => {
    const onConfirm = vi.fn();
    render(<DialogExample onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
