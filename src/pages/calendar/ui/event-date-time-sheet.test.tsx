import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DateTimeSheet } from "@/shared/ui/date-time-input";
import type { DateTimeRange } from "@/shared/ui/date-time-input";

const range = {
  startDate: "2026-10-21",
  endDate: "2026-10-21",
  startTime: "09:00",
  endTime: "10:00",
};

function Editor({
  initial = range,
  dateOnly = false,
  singleDate = false,
  timeOnly = false,
}: {
  initial?: DateTimeRange;
  dateOnly?: boolean;
  singleDate?: boolean;
  timeOnly?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [tab, setTab] = useState<"start" | "end" | null>(null);
  return (
    <>
      <output aria-label="폼 값">{JSON.stringify(value)}</output>
      {(["start", "end"] as const).map((side) => (
        <button key={side} id={`open-${side}`} onClick={() => setTab(side)}>
          {side === "start" ? "시작 열기" : "종료 열기"}
        </button>
      ))}
      {tab && (
        <DateTimeSheet
          range={value}
          initialTab={tab}
          dateOnly={dateOnly}
          singleDate={singleDate}
          timeOnly={timeOnly}
          onOpenChange={(open) => {
            if (!open) setTab(null);
          }}
          onConfirm={(next) => {
            setValue(next);
            setTab(null);
          }}
          onRestoreFocus={() => document.getElementById(`open-${tab}`)?.focus()}
        />
      )}
    </>
  );
}
function move(label: string, key = "ArrowDown") {
  fireEvent.keyDown(screen.getByRole("spinbutton", { name: label }), { key });
}
function formValue() {
  return JSON.parse(screen.getByLabelText("폼 값").textContent ?? "{}");
}

describe("CAL-01 CAL-02 SCN-CAL-1 P5.5 휠 시트", () => {
  it("시작 변경을 종료에 따라가게 하고 확인해야 폼에 반영해요", () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "시작 열기" }));
    move("시");
    expect(formValue()).toEqual(range);
    fireEvent.click(screen.getByRole("button", { name: "종료" }));
    expect(screen.getByRole("spinbutton", { name: "시" })).toHaveAttribute(
      "aria-valuetext",
      "11",
    );
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(formValue()).toEqual({
      ...range,
      startTime: "10:00",
      endTime: "11:00",
    });
  });
  it("종료가 시작보다 이르면 안내하고 확인을 막아요", () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "종료 열기" }));
    move("시", "ArrowUp");
    move("시", "ArrowUp");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "종료는 시작보다 뒤여야 해요.",
    );
    expect(screen.getByRole("button", { name: "확인" })).toBeDisabled();
  });
  it.each(["취소", "Escape"])(
    "%s로 닫으면 폼 값을 유지하고 연 행으로 포커스가 돌아와요",
    async (action) => {
      render(<Editor />);
      const trigger = screen.getByRole("button", { name: "종료 열기" });
      fireEvent.click(trigger);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "종료" })).toHaveFocus(),
      );
      move("시");
      if (action === "Escape")
        fireEvent.keyDown(document.activeElement ?? document.body, {
          key: "Escape",
        });
      else fireEvent.click(screen.getByRole("button", { name: action }));
      expect(formValue()).toEqual(range);
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
  it.each(["종일", "시간 미정"])(
    "%s에서는 날짜만 고르고 같은 날 종료도 확인할 수 있어요",
    () => {
      render(
        <Editor dateOnly initial={{ ...range, startTime: "", endTime: "" }} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "시작 열기" }));
      expect(screen.getAllByRole("spinbutton")).toHaveLength(3);
      expect(screen.getByRole("spinbutton", { name: "연도" })).toBeVisible();
      expect(screen.getByRole("button", { name: "확인" })).toBeEnabled();
      move("일");
      fireEvent.click(screen.getByRole("button", { name: "확인" }));
      expect(formValue()).toEqual({
        ...range,
        startDate: "2026-10-22",
        endDate: "2026-10-22",
        startTime: "",
        endTime: "",
      });
    },
  );
  it.each([
    { ...range, endTime: "" },
    { ...range, startTime: "" },
  ])("한쪽 빈 시각은 확인만 하거나 날짜만 옮겨도 채우지 않아요", (initial) => {
    render(<Editor initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "시작 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(formValue()).toEqual(initial);
    fireEvent.click(screen.getByRole("button", { name: "시작 열기" }));
    move("일");
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(formValue()).toEqual({
      ...initial,
      startDate: "2026-10-22",
      endDate: "2026-10-22",
    });
  });
  it("끝 시각 휠을 직접 바꾼 경우에만 비어 있던 끝 시각을 채워요", () => {
    render(<Editor initial={{ ...range, endTime: "" }} />);
    fireEvent.click(screen.getByRole("button", { name: "종료 열기" }));
    move("시");
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(formValue().endTime).toBe("10:00");
  });
});

it("CAL-01 SCN-CAL-1 시작 시각만 고쳐도 빈 종료 시각을 채우지 않아요", () => {
  render(<Editor initial={{ ...range, endTime: "" }} />);
  fireEvent.click(screen.getByRole("button", { name: "시작 열기" }));
  move("시");
  fireEvent.click(screen.getByRole("button", { name: "확인" }));
  expect(formValue()).toEqual({ ...range, startTime: "10:00", endTime: "" });
});

describe("CAL-01 CAL-02 SCN-CAL-1 P10.6.3 날짜 휠", () => {
  it("2021년 2월 8일을 골라 확인하면 종료도 같은 길이로 따라와요", () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "시작 열기" }));
    expect(screen.getAllByRole("spinbutton")).toHaveLength(6);
    for (let index = 0; index < 5; index += 1) move("연도", "ArrowUp");
    for (let index = 0; index < 8; index += 1) move("월", "ArrowUp");
    for (let index = 0; index < 13; index += 1) move("일", "ArrowUp");
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(formValue()).toEqual({
      ...range,
      startDate: "2021-02-08",
      endDate: "2021-02-08",
    });
  });
  it("윤년에서 평년으로 바꾸면 일 휠도 28일로 보정해요", () => {
    render(
      <Editor
        initial={{ ...range, startDate: "2024-02-29", endDate: "2024-02-29" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "시작 열기" }));
    move("연도");
    expect(screen.getByRole("spinbutton", { name: "일" })).toHaveAttribute(
      "aria-valuetext",
      "28일",
    );
    expect(screen.getByRole("spinbutton", { name: "일" })).toHaveAttribute(
      "aria-valuemax",
      "27",
    );
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(formValue().startDate).toBe("2025-02-28");
  });
  it("월을 바꿀 때 일 휠을 새 달에 맞추고 단일 날짜의 종료도 시작과 같게 해요", () => {
    render(
      <Editor
        dateOnly
        singleDate
        initial={{ ...range, startDate: "2026-03-31", endDate: "2026-03-31" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "시작 열기" }));
    expect(screen.getAllByRole("spinbutton")).toHaveLength(3);
    move("월");
    expect(screen.getByRole("spinbutton", { name: "일" })).toHaveAttribute(
      "aria-valuetext",
      "30일",
    );
    expect(screen.getByRole("spinbutton", { name: "일" })).toHaveAttribute(
      "aria-valuemax",
      "29",
    );
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(formValue()).toEqual({
      startDate: "2026-04-30",
      endDate: "2026-04-30",
      startTime: "",
      endTime: "",
    });
  });
  it("종료 날짜를 시작보다 앞으로 바꾸면 확인을 막아요", () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "종료 열기" }));
    move("연도", "ArrowUp");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "종료는 시작보다 뒤여야 해요.",
    );
    expect(screen.getByRole("button", { name: "확인" })).toBeDisabled();
  });
  it("시간만 입력할 때는 기존 시간 휠 3개만 보여요", () => {
    render(<Editor timeOnly singleDate />);
    fireEvent.click(screen.getByRole("button", { name: "시작 열기" }));
    expect(screen.getAllByRole("spinbutton")).toHaveLength(3);
    expect(
      screen.queryByRole("spinbutton", { name: "연도" }),
    ).not.toBeInTheDocument();
    move("분");
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(formValue().startTime).toBe("09:01");
  });
});
