import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { markHistoryBack, useHistoryBack } from "./use-history-back";

const back = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));
const path = "/settings/lists";
const HistoryLink = () => {
  const { onNavigate } = useHistoryBack(path);
  return <button onClick={onNavigate}>뒤로</button>;
};
beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, "", path);
  back.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each(["1", JSON.stringify({ path, time: Date.now() })])(
  "ACC-13 저장소에 남은 표식만으로 앱 밖으로 돌아가지 않아요 (%s)",
  (marker) => {
    sessionStorage.setItem(path, marker);
    render(<HistoryLink />);
    fireEvent.click(screen.getByRole("button"));
    expect(back).not.toHaveBeenCalled();
  },
);
it("ACC-13 저장소가 막혀도 앱 안 이동은 뒤로 돌아가요", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  markHistoryBack(path);
  render(<HistoryLink />);
  fireEvent.click(screen.getByRole("button"));
  expect(back).toHaveBeenCalledOnce();
});
it.each(["expired", "wrong-path"])(
  "ACC-13 %s 이동 표식은 소비하지 않아요",
  (reason) => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    markHistoryBack(reason === "wrong-path" ? "/other" : path);
    now.mockReturnValue(12000);
    render(<HistoryLink />);
    fireEvent.click(screen.getByRole("button"));
    expect(back).not.toHaveBeenCalled();
  },
);
