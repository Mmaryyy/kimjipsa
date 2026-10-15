import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormFieldRow } from "./form-field-row";

describe("P1 FormFieldRow (기능 SCN 연결 전)", () => {
  it("오류 상태를 입력에 전달하고 오류 메시지를 연결해요", () => {
    render(
      <FormFieldRow
        label="이름"
        htmlFor="name"
        invalid
        error="이름을 입력해 주세요"
      >
        {(controlProps) => <input {...controlProps} />}
      </FormFieldRow>,
    );
    const input = screen.getByRole("textbox", { name: "이름" });
    const error = screen.getByRole("alert");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(error).toHaveTextContent("이름을 입력해 주세요");
    expect(error).toHaveAttribute("id", "name-error");
    expect(input).toHaveAttribute("aria-describedby", error.id);
    expect(input).toHaveAccessibleDescription("이름을 입력해 주세요");
  });

  it("정상 상태에서는 오류 속성과 메시지가 없어요", () => {
    render(
      <FormFieldRow label="이름" htmlFor="name">
        {(controlProps) => <input {...controlProps} />}
      </FormFieldRow>,
    );
    const input = screen.getByRole("textbox", { name: "이름" });
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
