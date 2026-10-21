import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WheelPicker, WheelPickerWrapper } from "./wheel-picker";

function ControlledPicker() {
  const [value, setValue] = useState("9");
  return (
    <WheelPickerWrapper>
      <WheelPicker
        label="시"
        value={value}
        onValueChange={setValue}
        options={[
          { value: "9", label: "9" },
          { value: "10", label: "10" },
        ]}
      />
    </WheelPickerWrapper>
  );
}

afterEach(cleanup);
describe("CAL-01 SCN-CAL-1 P5.5 휠 접근성", () => {
  it("위아래 키로 이동하고 처음 선택한 시각으로 되돌릴 수 있어요", () => {
    render(<ControlledPicker />);
    const hour = screen.getByRole("spinbutton", { name: "시" });
    expect(hour).toHaveAttribute("aria-valuetext", "9");
    fireEvent.keyDown(hour, { key: "ArrowDown" });
    expect(hour).toHaveAttribute("aria-valuetext", "10");
    fireEvent.keyDown(hour, { key: "ArrowUp" });
    expect(hour).toHaveAttribute("aria-valuetext", "9");
    fireEvent.keyDown(hour, { key: "ArrowDown" });
    expect(hour).toHaveAttribute("aria-valuetext", "10");
  });
});
