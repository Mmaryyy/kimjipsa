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
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

it("CAL-12 P15.1b 확인창은 취소·보조·확인 순서의 한 줄 버튼을 제공해요", () => {
  render(
    <ConfirmDialog
      open
      onOpenChange={vi.fn()}
      title="변경"
      description="확인"
      destructive={false}
      confirmLabel="저장"
      cancelLabel="계속 편집"
      onConfirm={vi.fn()}
      secondaryAction={{ label: "저장 안 함", onClick: vi.fn() }}
    />,
  );
  const buttons = screen.getAllByRole("button");
  expect(buttons.map((button) => button.textContent)).toEqual([
    "계속 편집",
    "저장 안 함",
    "저장",
  ]);
  expect(buttons[0].parentElement).toHaveClass("grid-cols-3");
  expect(buttons[0]).toHaveClass("bg-muted");
  expect(buttons[1]).toHaveClass("bg-muted");
  expect(buttons[2]).toHaveClass("bg-primary");
});
