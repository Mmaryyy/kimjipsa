import type { AnchorHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { markHistoryBack } from "@/shared/lib";
import { eventRoutes, settingsPath } from "@/shared/config";
import { EventCategoriesPage } from "./event-categories-page";

const navigation = vi.hoisted(() => ({ back: vi.fn(), from: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: navigation.back }),
  useSearchParams: () => new URLSearchParams(navigation.from),
}));
vi.mock("next/link", () => ({
  default: ({
    onNavigate,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    onNavigate?: (event: { preventDefault: () => void }) => void;
  }) => (
    <a
      {...props}
      onClick={(event) => {
        if (!event.ctrlKey && !event.metaKey) onNavigate?.(event);
        event.preventDefault();
      }}
    />
  ),
}));
vi.mock("@/entities/event", () => ({
  useEventCategories: () => ({ isPending: true }),
}));
vi.mock("./sortable-category-list", () => ({ default: () => null }));
vi.mock("./event-category-form", () => ({ EventCategoryForm: () => null }));
vi.mock("@/shared/ui", () => ({
  PageLayout: ({ header }: { header: ReactNode }) => header,
  PageHeader: ({ navigation }: { navigation: ReactNode }) => navigation,
  Button: () => null,
  TextButton: () => null,
  Sheet: () => null,
}));

describe("ACC-13 r227-f1 일정 카테고리 뒤로 가기", () => {
  beforeEach(() => {
    navigation.back.mockReset();
    navigation.from = "";
    sessionStorage.clear();
    window.history.replaceState({}, "", eventRoutes.categories);
  });

  it.each([
    ["일정", "from=calendar"],
    ["설정", ""],
  ])("%s에서 들어오면 이전 화면으로 돌아가요", (_label, from) => {
    navigation.from = from;
    markHistoryBack(eventRoutes.categories);
    render(<EventCategoriesPage />);
    const link = screen.getByRole("link", { name: "뒤로" });
    expect(link).toHaveAttribute(
      "href",
      from ? eventRoutes.calendar : settingsPath,
    );
    fireEvent.click(link);
    expect(navigation.back).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(eventRoutes.categories)).toBeNull();
    expect(window.history.state[eventRoutes.categories]).toBe(true);
  });

  it("직접 진입하면 출처 화면으로 이동해요", () => {
    navigation.from = "from=calendar";
    render(<EventCategoriesPage />);
    const link = screen.getByRole("link", { name: "뒤로" });
    expect(link).toHaveAttribute("href", eventRoutes.calendar);
    fireEvent.click(link);
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("새로 고친 뒤에도 이전 화면으로 돌아가며 새 탭 동작은 유지해요", () => {
    navigation.from = "from=calendar";
    window.history.replaceState({ [eventRoutes.categories]: true }, "");
    render(<EventCategoriesPage />);
    const link = screen.getByRole("link", { name: "뒤로" });
    fireEvent.click(link, { ctrlKey: true });
    expect(navigation.back).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(navigation.back).toHaveBeenCalledOnce();
  });
});
