import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToggleGroup } from "./toggle-group";

function ToggleGroupExample() {
  const [value, setValue] = useState("month");
  return (
    <ToggleGroup
      label="보기"
      appearance="segmented"
      value={value}
      onValueChange={setValue}
      options={[
        { value: "month", label: "월" },
        { value: "week", label: "주" },
      ]}
    />
  );
}

describe("P1 ToggleGroup (기능 SCN 연결 전)", () => {
  it("옵션을 누르면 선택 값이 바뀌고 다시 눌러도 선택을 유지해요", () => {
    render(<ToggleGroupExample />);
    const group = within(screen.getByRole("radiogroup", { name: "보기" }));
    const month = group.getByRole("radio", { name: "월" });
    const week = group.getByRole("radio", { name: "주" });
    expect(month).toHaveAttribute("aria-checked", "true");
    expect(week).toHaveAttribute("aria-checked", "false");
    fireEvent.click(week);
    expect(week).toHaveAttribute("aria-checked", "true");
    expect(month).toHaveAttribute("aria-checked", "false");
    fireEvent.click(week);
    expect(week).toHaveAttribute("aria-checked", "true");
  });
});
