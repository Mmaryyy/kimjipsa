import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { FormProvider, useForm } from "react-hook-form";
import { FormField, defineFields, type FormFieldProps } from "./";

type Values = {
  name: string;
  count: number;
  choice: number | null;
  enabled: boolean;
  nested: { title: string };
};
const Field = FormField<Values>;
function Example({
  onSave,
  error = false,
}: {
  onSave: (values: Values) => void;
  error?: boolean;
}) {
  const form = useForm<Values>({
    defaultValues: {
      name: "",
      count: 10,
      choice: null,
      enabled: false,
      nested: { title: "기본" },
    },
    errors: error
      ? { name: { type: "required", message: "이름을 입력해 주세요." } }
      : {},
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSave)}>
        <Field name="name" label="이름" hint="표시할 이름이에요." />
        <Field
          name="choice"
          label="선택"
          type="select"
          noneLabel="없음"
          parse={(value) => value}
          options={[
            { value: 0, label: "영" },
            { value: 2, label: "둘" },
          ]}
        />
        <Field name="enabled" label="사용" type="switch" />
        <Field
          name="count"
          label="변환"
          format={(value) => String(value * 2)}
          parse={(value) => Number(value) / 2}
        />
        <Field
          name="nested.title"
          label="직접 입력"
          render={(field) => <input {...field} placeholder="직접" />}
        />
        <button type="submit">저장</button>
      </form>
    </FormProvider>
  );
}
function TypedInputs({
  onSave,
  allowDirectInput = true,
}: {
  allowDirectInput?: boolean;
  onSave: (values: {
    amount: number;
    option: string | null;
    view: "list" | "grid";
    quantity: number;
  }) => void;
}) {
  const form = useForm({
    defaultValues: {
      amount: 4,
      option: null as string | null,
      view: "list" as "list" | "grid",
      quantity: 1,
    },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSave)}>
        <FormField<{
          amount: number;
          option: string | null;
          view: "list" | "grid";
          quantity: number;
        }>
          name="amount"
          label="숫자"
          type="number"
        />
        <FormField<{ option: string | null }>
          name="option"
          label="문자 선택"
          type="select"
          noneLabel="없음"
          options={[{ value: "none", label: "실제 none" }]}
        />
        <FormField<{ view: "list" | "grid" }>
          name="view"
          label="보기"
          type="segmented"
          options={[
            { value: "list", label: "목록" },
            { value: "grid", label: "격자" },
          ]}
        />
        <FormField<{ quantity: number }>
          name="quantity"
          label="수량"
          type="quantity"
          allowDirectInput={allowDirectInput}
        />
        <button type="submit">입력 저장</button>
      </form>
    </FormProvider>
  );
}
afterEach(cleanup);
describe("P15.2 FormField CAL/INV/CART/ACC 공용 입력", () => {
  it("라벨과 고유 id를 연결하고 hint를 낭독해요", () => {
    render(
      <>
        <Example onSave={vi.fn()} />
        <Example onSave={vi.fn()} />
      </>,
    );
    const inputs = screen.getAllByRole("textbox", { name: "이름" });
    expect(inputs[0].id).not.toBe(inputs[1].id);
    for (const input of inputs) {
      expect(
        document.querySelector(`label[for="${input.id}"]`),
      ).toHaveTextContent("이름");
      expect(input).toHaveAccessibleDescription("표시할 이름이에요.");
      expect(input).not.toHaveAttribute("aria-invalid");
    }
  });
  it("오류를 aria-describedby와 role=alert로 연결해요", () => {
    render(<Example onSave={vi.fn()} error />);
    const input = screen.getByRole("textbox", { name: "이름" });
    const alert = screen.getByRole("alert");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(
      alert.id,
    );
    expect(input).toHaveAccessibleDescription(
      "이름을 입력해 주세요. 표시할 이름이에요.",
    );
  });
  it("select는 null과 없음, 숫자 0을 오가며 원래 값 타입을 저장해요", async () => {
    const onSave = vi.fn();
    render(<Example onSave={onSave} />);
    const select = screen.getByRole("combobox", { name: "선택" });
    expect(select).toHaveValue("none");
    fireEvent.change(select, { target: { value: "0" } });
    fireEvent.click(screen.getByText("저장"));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({ choice: 0 }),
        expect.anything(),
      ),
    );
    fireEvent.change(select, { target: { value: "none" } });
    fireEvent.click(screen.getByText("저장"));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({ choice: null }),
        expect.anything(),
      ),
    );
  });
  it("switch·parse/format·render도 같은 폼 값으로 제출해요", async () => {
    const onSave = vi.fn();
    render(<Example onSave={onSave} />);
    expect(screen.getByLabelText("변환")).toHaveValue("20");
    fireEvent.change(screen.getByLabelText("변환"), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "사용" }));
    fireEvent.change(screen.getByPlaceholderText("직접"), {
      target: { value: "변경" },
    });
    fireEvent.click(screen.getByText("저장"));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 20,
          enabled: true,
          nested: { title: "변경" },
        }),
        expect.anything(),
      ),
    );
  });
  it("숫자 빈 입력과 0·실제 none 선택지·segmented·quantity를 저장해요", async () => {
    const onSave = vi.fn();
    render(<TypedInputs onSave={onSave} />);
    const number = screen.getByRole("spinbutton", { name: "숫자" });
    fireEvent.change(number, { target: { value: "" } });
    expect(number).toHaveDisplayValue("");
    fireEvent.change(number, { target: { value: "0" } });
    fireEvent.change(screen.getByRole("combobox", { name: "문자 선택" }), {
      target: { value: "none" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "격자" }));
    fireEvent.click(screen.getByRole("button", { name: "수량 늘리기" }));
    fireEvent.click(screen.getByText("입력 저장"));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        { amount: 0, option: "none", view: "grid", quantity: 2 },
        expect.anything(),
      ),
    );
  });
  it.each(["1.05", "0.05"])("소수 %s 입력 중 끝의 0을 유지해요", (value) => {
    render(<TypedInputs onSave={vi.fn()} />);
    const number = screen.getByRole("spinbutton", { name: "숫자" });
    fireEvent.change(number, { target: { value: value.slice(0, -1) } });
    expect(number).toHaveDisplayValue(value.slice(0, -1));
    fireEvent.change(number, { target: { value } });
    expect(number).toHaveDisplayValue(value);
  });
  it("수량 라벨로 값을 늘리거나 입력 모드를 열지 않아요", () => {
    render(<TypedInputs onSave={vi.fn()} />);
    fireEvent.click(screen.getByText("수량", { selector: "label" }));
    expect(screen.queryByRole("textbox", { name: "수량 수량" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "수량 수량 직접 입력" }),
    ).toHaveTextContent("1");
  });
  it("직접 입력 없는 수량 라벨은 늘리기 버튼에 연결되지 않아요", () => {
    render(<TypedInputs onSave={vi.fn()} allowDirectInput={false} />);
    const label = screen.getByText("수량", { selector: "label" });
    const target = document.getElementById(label.getAttribute("for")!);
    expect(target).toHaveAttribute("role", "group");
    fireEvent.click(label);
    expect(target).toHaveTextContent("1");
  });
  it("defineFields 배열은 name과 type별 props 검사를 유지해요", () => {
    const rows = defineFields<Values>()([
      { name: "name", label: "이름" },
      {
        name: "choice",
        label: "선택",
        type: "select",
        options: [{ value: 2, label: "둘" }],
      },
    ]);
    expectTypeOf(rows[0]).toEqualTypeOf<FormFieldProps<Values>>();
    // @ts-expect-error select에는 options가 필요해요.
    const missingOptions: FormFieldProps<Values> = {
      name: "choice",
      label: "선택",
      type: "select",
    };
    const wrongName: FormFieldProps<Values> = {
      // @ts-expect-error 폼에 없는 name은 거절해요.
      name: "missing",
      label: "이름",
    };
    // @ts-expect-error switch는 boolean 필드에만 쓸 수 있어요.
    const wrongSwitch: FormFieldProps<Values> = {
      name: "name",
      label: "사용",
      type: "switch",
    };
    const wrongNone: FormFieldProps<Values> = {
      name: "name",
      label: "이름",
      type: "select",
      options: [],
      // @ts-expect-error null을 저장할 수 없는 필드는 없음 선택지를 거절해요.
      noneLabel: "없음",
    };
    expect(wrongNone).toBeDefined();
    const wrongOption: FormFieldProps<Values> = {
      name: "choice",
      label: "선택",
      type: "select",
      // @ts-expect-error 숫자 select에 문자열 option을 넣을 수 없어요.
      options: [{ value: "two", label: "둘" }],
    };
    // @ts-expect-error 배열에서도 폼에 없는 name을 거절해요.
    defineFields<Values>()([{ name: "missing", label: "이름" }]);
    // @ts-expect-error 배열에서도 select options 누락을 거절해요.
    defineFields<Values>()([{ name: "choice", label: "선택", type: "select" }]);
    // @ts-expect-error 배열에서도 문자열 switch를 거절해요.
    defineFields<Values>()([{ name: "name", label: "사용", type: "switch" }]);
    defineFields<Values>()([
      // @ts-expect-error text 행에 select 전용 props를 넣을 수 없어요.
      { name: "name", label: "이름", type: "text", options: [] },
    ]);
    expect([missingOptions, wrongName, wrongSwitch, wrongOption]).toHaveLength(
      4,
    );
  });
});
