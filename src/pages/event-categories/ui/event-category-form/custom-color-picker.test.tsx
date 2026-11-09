import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { eventCategoryColors } from "@/entities/event";
import type { CategoryColor } from "@/shared/lib";
import EventCategoryColorPicker from "./ColorPicker";
import type * as EventModule from "@/entities/event";
vi.mock("@/entities/event", async (load) => ({
  ...(await load<typeof EventModule>()),
  useSavedCategoryColors: () => ({
    data: [],
    isPending: false,
    isError: false,
  }),
}));
describe.each([false, true])("CAL-08 직접 색 접근성 (모바일 %s)", (mobile) => {
  it("슬라이더를 한국어로 읽고 닫으면 라디오로 포커스를 돌려요", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches:
        mobile &&
        (query === "(max-width: 767px)" || query === "(pointer: coarse)"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(
      <EventCategoryColorPicker
        color={Object.keys(eventCategoryColors)[0] as CategoryColor}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "직접 선택" }));
    expect(
      screen.getByRole("slider", { name: "채도와 밝기" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "색상" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "직접 선택 색" })).toHaveFocus(),
    );
  });
});
