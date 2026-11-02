import { describe, expect, it } from "vitest";
import {
  advanceTabSpring,
  cancelTabGesture,
  nearestTab,
  tabLensShape,
} from "./liquid-tab-motion.utils";
import { liquidTabMotionTokens as tokens } from "./liquid-tab-motion.constants";

describe("P10.6 하단 렌즈 계산", () => {
  it("가장 가까운 탭과 양 끝 영역을 판정해요", () => {
    expect(
      [-44, 0, 69, 70, 139, 349, 394].map((x) => nearestTab(x, 350, 5)),
    ).toEqual([0, 0, 0, 1, 1, 4, 4]);
  });
  it("가로 드래그 전 세로 스크롤만 취소해요", () => {
    expect(cancelTabGesture(2, 8, false)).toBe(true);
    expect(cancelTabGesture(8, 2, false)).toBe(false);
    expect(cancelTabGesture(2, 8, true)).toBe(false);
  });
  it("동작 감소에서는 확대와 스프링 없이 선택 위치를 유지해요", () => {
    expect(tabLensShape(1, 0.14, true)).toEqual({
      rail: 1,
      width: 1,
      height: 1,
      content: 1,
    });
    expect(advanceTabSpring(0, 100, 70, 0.016, tokens.follow, true)).toEqual({
      value: 70,
      velocity: 0,
    });
  });
  it("누른 렌즈가 확대되고 놓으면 안정적으로 원래 위치에 안착해요", () => {
    expect(tabLensShape(1, 0, false)).toEqual({
      rail: 1.04,
      width: 1.16,
      height: 1.38,
      content: 1.22,
    });
    let state = { value: 0, velocity: 0 };
    for (let frame = 0; frame < 120; frame++)
      state = advanceTabSpring(
        state.value,
        state.velocity,
        70,
        0.016,
        tokens.settle,
        false,
      );
    expect(state.value).toBeCloseTo(70, 3);
    expect(state.velocity).toBeCloseTo(0, 3);
  });
});
