/* eslint-disable tokens/no-color-literals -- 직접 선택 저장값을 검증해요. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventCategoryColors } from "@/entities/event";
import { readableTextColor } from "@/shared/lib";
import EventCategoryForm from "./";
import type * as EventModule from "@/entities/event";
import type { EventCategory } from "@/entities/event";
const { onSave, savedColors } = vi.hoisted(() => ({
  savedColors: { data: ["#ab1234"], isPending: false, isError: false },
  onSave: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/entities/event", async (load) => ({
  ...(await load<typeof EventModule>()),
  useEventCategories: () => ({ data: [] }),
  useSavedCategoryColors: () => savedColors,
}));
vi.mock("../../model/use-category-editor", () => ({
  useCategoryEditor: () => ({ onSave, onDelete: vi.fn(), deleting: false }),
}));
vi.mock("react-colorful", () => ({
  HexColorPicker: ({
    color,
    onChange,
  }: {
    color: string;
    onChange: (color: string) => void;
  }) => (
    <button
      type="button"
      aria-label="색 조정"
      data-color={color}
      onClick={() => onChange("#AA1234")}
    />
  ),
}));
const category: EventCategory = {
  id: "test",
  name: "직장",
  color: "blue",
  sortOrder: 0,
};
const submit = () =>
  fireEvent.submit(document.getElementById("category-form")!);
beforeEach(() => {
  vi.clearAllMocks();
  savedColors.data = ["#ab1234"];
  savedColors.isPending = false;
});
describe.each([false, true])(
  "CAL-08 카테고리 색 선택 (모바일 %s)",
  (mobile) => {
    beforeEach(() => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches:
          mobile &&
          (query === "(max-width: 767px)" || query === "(pointer: coarse)"),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
    });
    it("프리셋 6개와 최신 저장 색 7개, 스포이드로 14칸을 채워요", () => {
      savedColors.data = Array.from(
        { length: 8 },
        (_, index) => `#ab123${index}`,
      );
      render(
        <EventCategoryForm
          category={{ ...category, color: "#ab1237" }}
          onSaved={() => {}}
        />,
      );
      expect(screen.getAllByRole("radio")).toHaveLength(14);
      for (const label of Object.values(eventCategoryColors)) {
        expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
      }
      expect(
        screen.getByRole("radio", { name: "저장한 색 #ab1236" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("radio", { name: "저장한 색 #ab1237" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "직접 선택 색" })).toBeChecked();
    });
    it("불러오는 동안 진행 막대를 보이고 스포이드 선택 강조를 미뤄요", () => {
      savedColors.isPending = true;
      const props = {
        category: { ...category, color: "#ab1234" } as EventCategory,
        onSaved: () => {},
      };
      const view = render(<EventCategoryForm {...props} />);
      expect(
        screen.getByRole("progressbar", { name: "저장한 색 불러오는 중" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: "직접 선택 색" }),
      ).not.toBeChecked();
      savedColors.isPending = false;
      view.rerender(<EventCategoryForm {...props} />);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: "저장한 색 #ab1234" }),
      ).toBeChecked();
    });
    it.each([" ", "Enter"])(
      "화살표 선택은 피커를 열지 않고 %s로 확정할 때 열어요",
      (key) => {
        render(<EventCategoryForm category={category} onSaved={() => {}} />);
        const radio = screen.getByRole("radio", { name: "직접 선택 색" });
        fireEvent.click(radio);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "직접 선택" }),
        ).toHaveAttribute("tabindex", "-1");
        fireEvent.keyDown(radio, { key });
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      },
    );
    it("직접 고른 색은 스포이드 바탕에 채우고 아이콘은 자동 글자색으로 보여요", () => {
      render(<EventCategoryForm category={category} onSaved={() => {}} />);
      const picker = screen.getByRole("button", { name: "직접 선택" });
      fireEvent.click(picker);
      fireEvent.click(screen.getByRole("button", { name: "색 조정" }));
      fireEvent.click(screen.getByRole("button", { name: "선택" }));
      const color = "#aa1234";
      expect(picker).toHaveStyle({ backgroundColor: color });
      expect(picker.querySelector("svg")).toHaveStyle({
        color: readableTextColor(color),
      });
    });
    it("새 프리셋을 선택해 저장해요", async () => {
      render(<EventCategoryForm category={category} onSaved={() => {}} />);
      fireEvent.click(screen.getByLabelText("크림"));
      submit();
      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith({
          name: "직장",
          color: "cream",
          sortOrder: 0,
        }),
      );
    });
    it("직접 고른 빨강을 소문자로 저장하고 다시 열어도 유지해요", async () => {
      const view = render(
        <EventCategoryForm category={category} onSaved={() => {}} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "직접 선택" }));
      expect(screen.getByRole("button", { name: "색 조정" })).toHaveAttribute(
        "data-color",
        "#81a6c6",
      );
      fireEvent.click(screen.getByRole("button", { name: "색 조정" }));
      fireEvent.click(screen.getByRole("button", { name: "선택" }));
      submit();
      const saved = { ...category, color: "#aa1234" } as EventCategory;
      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith({
          name: saved.name,
          color: saved.color,
          sortOrder: 0,
        }),
      );
      view.unmount();
      render(<EventCategoryForm category={saved} onSaved={() => {}} />);
      fireEvent.click(screen.getByRole("button", { name: "직접 선택" }));
      expect(screen.getByRole("button", { name: "색 조정" })).toHaveAttribute(
        "data-color",
        saved.color,
      );
    });
    it("직접 색을 고른 뒤 프리셋으로 바꿔도 이전 직접 색으로 열어요", () => {
      render(
        <EventCategoryForm
          category={{ ...category, color: "#aa1234" }}
          onSaved={() => {}}
        />,
      );
      fireEvent.click(screen.getByLabelText("크림"));
      fireEvent.click(screen.getByRole("button", { name: "직접 선택" }));
      expect(screen.getByRole("button", { name: "색 조정" })).toHaveAttribute(
        "data-color",
        "#aa1234",
      );
      fireEvent.click(screen.getByRole("button", { name: "선택" }));
      expect(screen.getByRole("radio", { name: "직접 선택 색" })).toBeChecked();
      fireEvent.click(screen.getByLabelText("크림"));
      fireEvent.click(screen.getByRole("radio", { name: "직접 선택 색" }));
      expect(screen.getByRole("radio", { name: "직접 선택 색" })).toBeChecked();
    });
    it.each(["취소", "Escape"])(
      "%s로 닫으면 폼 값과 다음 피커의 시작 색이 그대로예요",
      async (method) => {
        render(<EventCategoryForm category={category} onSaved={() => {}} />);
        const trigger = screen.getByRole("button", { name: "직접 선택" });
        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole("button", { name: "색 조정" }));
        if (method === "취소")
          fireEvent.click(screen.getByRole("button", { name: "취소" }));
        else fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        submit();
        await waitFor(() =>
          expect(onSave).toHaveBeenCalledWith({
            name: "직장",
            color: "blue",
            sortOrder: 0,
          }),
        );
        fireEvent.click(trigger);
        expect(screen.getByRole("button", { name: "색 조정" })).toHaveAttribute(
          "data-color",
          "#81a6c6",
        );
      },
    );
    it("저장한 색을 칩으로 다시 골라 저장해요", async () => {
      render(<EventCategoryForm category={category} onSaved={() => {}} />);
      fireEvent.click(screen.getByRole("radio", { name: "저장한 색 #ab1234" }));
      submit();
      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith({
          name: "직장",
          color: "#ab1234",
          sortOrder: 0,
        }),
      );
    });
  },
);
