import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toast } from "./toast";
import { ToastProvider } from "./toast-provider";

function ToastExample({
  duration = 5000,
  action,
}: {
  duration?: number;
  action?: { label: string; onClick: () => void };
}) {
  const [open, setOpen] = useState(true);
  return (
    <ToastProvider>
      <Toast
        open={open}
        onOpenChange={setOpen}
        message="순서를 저장했어요"
        duration={duration}
        action={action}
      />
    </ToastProvider>
  );
}

describe("ACC-13 r050-f1 공용 토스트", () => {
  it("일시 알림은 동작 버튼 없이 문구만 보이고 시간이 지나면 닫혀요", async () => {
    render(<ToastExample duration={100} />);
    const toast = screen.getByRole("listitem");
    expect(within(toast).getByText("순서를 저장했어요")).toBeVisible();
    expect(within(toast).queryByRole("button")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument(),
    );
  });

  it("일시 알림의 동작은 버튼으로 실행하고 닫기 버튼을 추가하지 않아요", () => {
    const onClick = vi.fn();
    render(<ToastExample action={{ label: "되돌리기", onClick }} />);
    const toast = screen.getByRole("listitem");
    expect(within(toast).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(within(toast).getByRole("button", { name: "되돌리기" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("지속 알림은 이동과 닫기를 키보드로 접근 가능한 버튼으로 제공해요", () => {
    const onClick = vi.fn();
    render(
      <ToastExample
        duration={Infinity}
        action={{ label: "홈으로 이동", onClick }}
      />,
    );
    const toast = screen.getByRole("listitem");
    const action = within(toast).getByRole("button", { name: "홈으로 이동" });
    const close = within(toast).getByRole("button", { name: "알림 닫기" });
    action.focus();
    expect(action).toHaveFocus();
    close.focus();
    expect(close).toHaveFocus();
    fireEvent.click(close);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
