import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import QuantityStepper from ".";

function setup(props: Partial<ComponentProps<typeof QuantityStepper>> = {}) {
  const onValueChange = vi.fn();
  const view = render(
    <QuantityStepper
      label="우유"
      value={2}
      unit="팩"
      onValueChange={onValueChange}
      allowDirectInput
      {...props}
    />,
  );
  return { ...view, onValueChange };
}
function enterQuantity(value: string) {
  fireEvent.click(screen.getByRole("button", { name: "우유 수량 직접 입력" }));
  const input = screen.getByRole("textbox", { name: "우유 수량" });
  fireEvent.change(input, { target: { value } });
  return input;
}

describe("INV-15 SCN-INV-2 수량 직접 입력", () => {
  it("숫자를 누르면 라벨과 소수 키패드가 있는 입력란에 포커스를 줘요", () => {
    setup();
    const input = enterQuantity("2.5");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByLabelText("우유 수량")).toBe(input);
  });
  it.each(["Enter", "blur"])("%s로 소수 수량을 한 번 저장해요", (action) => {
    const { onValueChange } = setup();
    const input = enterQuantity("2.5");
    if (action === "blur") fireEvent.blur(input);
    else fireEvent.keyDown(input, { key: action });
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(2.5);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("Escape는 입력을 취소하고 원래 수량으로 돌아가요", () => {
    const { onValueChange } = setup();
    fireEvent.keyDown(enterQuantity("8"), { key: "Escape" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "우유 수량 직접 입력" }),
    ).toHaveTextContent("2팩");
  });
  it.each(["", " ", "-1", "1..2", "abc", "Infinity", "1e3", "0x10", "2"])(
    "빈 값·잘못된 형식·변경 없는 값(%s)은 저장하지 않아요",
    (value) => {
      const { onValueChange } = setup();
      fireEvent.blur(enterQuantity(value));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "우유 수량 직접 입력" }),
      ).toHaveTextContent("2팩");
    },
  );
  it("0도 유효한 수량으로 저장해요", () => {
    const { onValueChange } = setup();
    fireEvent.blur(enterQuantity("0"));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(0);
  });
  it("범위 밖 직접 입력은 저장하지 않아요", () => {
    const { onValueChange } = setup({ max: 5 });
    fireEvent.blur(enterQuantity("6"));
    expect(onValueChange).not.toHaveBeenCalled();
  });
  it("직접 입력을 켜지 않은 사용처는 기존 출력과 +/-만 유지해요", () => {
    const { onValueChange } = setup({ allowDirectInput: false });
    expect(
      screen.queryByRole("button", { name: "우유 수량 직접 입력" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2팩");
    fireEvent.click(screen.getByRole("button", { name: "우유 늘리기" }));
    fireEvent.click(screen.getByRole("button", { name: "우유 줄이기" }));
    expect(onValueChange.mock.calls).toEqual([[3], [1]]);
  });
  it("비활성 상태에서는 직접 입력과 +/-를 막아요", () => {
    setup({ disabled: true });
    for (const button of screen.getAllByRole("button"))
      expect(button).toBeDisabled();
  });
});
