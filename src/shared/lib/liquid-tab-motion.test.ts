import { describe, expect, it } from "vitest";
import {
  advanceTabSpring,
  cancelTabGesture,
  nearestTab,
  targetLiquidTab,
  type LiquidTabMotion,
} from "./liquid-tab-motion.utils";

const createMotion = (): LiquidTabMotion => ({
  x: 0,
  target: 0,
  velocity: 0,
  selectionScale: 1,
  lift: 0,
  liftVelocity: 0,
  sx: 1,
  sy: 1,
});
const bounds = {
  step: 70,
  max: 280,
  left: 10,
  center: 185,
  viewportWidth: 375,
};

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
    const state = { ...createMotion(), target: 70, velocity: 100, lift: 1 };
    expect(advanceTabSpring(state, bounds, true, true, 0.016)).toBe(false);
    expect(state).toEqual({ ...createMotion(), x: 70, target: 70 });
  });
  it("먼 탭은 더 천천히 이동하고 같은 목표를 다시 받아도 속도를 유지해요", () => {
    const state = createMotion();
    targetLiquidTab(state, 280, 70);
    expect(state.selectionScale).toBe(2.2);
    state.x = 210;
    targetLiquidTab(state, 280, 70);
    expect(state.selectionScale).toBe(2.2);
    targetLiquidTab(state, 140, 70);
    expect(state.selectionScale).toBe(1);
  });
  it("32ms 프레임을 120Hz로 나눠 위치와 높이를 함께 적분해요", () => {
    const state = { ...createMotion(), target: 70 };
    const split = { ...state };
    advanceTabSpring(state, bounds, true, false, 0.032);
    for (let step = 0; step < 4; step++)
      advanceTabSpring(split, bounds, true, false, 0.008);
    expect(state.x).toBeCloseTo(split.x, 10);
    expect(state.lift).toBeCloseTo(split.lift, 10);
    const delayed = { ...createMotion(), target: 70 };
    advanceTabSpring(delayed, bounds, true, false, 1);
    expect(delayed).toEqual(state);
  });
  it("범위를 벗어나면 위치와 높이를 자르고 해당 속도를 없애요", () => {
    const state = {
      ...createMotion(),
      x: 280,
      target: 280,
      velocity: 1000,
      lift: 1,
      liftVelocity: 100,
    };
    advanceTabSpring(state, bounds, true, false, 0.032);
    expect(state.x).toBe(280);
    expect(state.velocity).toBe(0);
    expect(state.lift).toBe(1);
    expect(state.liftVelocity).toBe(0);
  });
  it.each([1 / 30, 1 / 60, 1 / 120])(
    "%s초 프레임에서도 놓은 렌즈가 목표에 안착해요",
    (dt) => {
      const state = createMotion();
      targetLiquidTab(state, 280, 70);
      for (let frame = 0; frame < 30; frame++)
        advanceTabSpring(state, bounds, true, false, dt);
      let moving = true;
      for (let frame = 0; frame < 600 && moving; frame++)
        moving = advanceTabSpring(state, bounds, false, false, dt);
      expect(moving).toBe(false);
      expect(state.sx).toBeCloseTo(1, 3);
      expect(state.sy).toBeCloseTo(1, 3);
      expect(state).toMatchObject({
        x: 280,
        velocity: 0,
        lift: 0,
        liftVelocity: 0,
      });
    },
  );
});
