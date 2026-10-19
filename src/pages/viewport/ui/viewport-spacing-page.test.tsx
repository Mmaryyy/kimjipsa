import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spacingStorageKey, spacingValues } from "../config/spacing.constants";
import { ViewportSpacingPage } from "./viewport-spacing-page";

describe("p4j-5 여백 실험", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("값 버튼으로 헤더 패딩을 바꾸고 선택값을 저장해요", async () => {
    render(<ViewportSpacingPage />);
    const header = screen
      .getByRole("heading", { name: "오늘" })
      .closest("header");
    expect(header).toHaveStyle({ paddingTop: "20px" });
    await waitFor(() =>
      expect(screen.getByText(/display-mode:/)).not.toHaveTextContent(
        "측정 중",
      ),
    );

    for (const value of spacingValues) {
      const button = screen.getByRole("button", { name: `${value}px` });
      fireEvent.click(button);
      expect(header).toHaveStyle({ paddingTop: `${value}px` });
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(sessionStorage.getItem(spacingStorageKey)).toBe(String(value));
    }
  });

  it("화면을 다시 열면 0px를 포함한 저장값을 복원해요", async () => {
    const view = render(<ViewportSpacingPage />);
    fireEvent.click(screen.getByRole("button", { name: "0px" }));
    view.unmount();
    render(<ViewportSpacingPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "0px" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(
      screen.getByRole("heading", { name: "오늘" }).closest("header"),
    ).toHaveStyle({ paddingTop: "0px" });
  });
});
