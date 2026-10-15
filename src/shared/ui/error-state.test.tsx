import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "./error-state";

describe("P1 ErrorState (기능 SCN 연결 전)", () => {
  it("오류 메시지를 알리고 재시도 버튼으로 핸들러를 호출해요", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("불러오지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도하기" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
