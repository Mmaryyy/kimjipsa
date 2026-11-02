import { liquidTabMotionTokens as tokens } from "./liquid-tab-motion.constants";

export function nearestTab(x: number, width: number, count: number) {
  return Math.max(0, Math.min(count - 1, Math.floor(x / (width / count))));
}

export function cancelTabGesture(dx: number, dy: number, dragging: boolean) {
  return (
    !dragging &&
    Math.abs(dy) >= tokens.gesture.verticalCancelThresholdPx &&
    Math.abs(dy) > Math.abs(dx)
  );
}

export function advanceTabSpring(
  value: number,
  velocity: number,
  target: number,
  seconds: number,
  spring: { stiffness: number; damping: number },
  reduced: boolean,
) {
  if (reduced) return { value: target, velocity: 0 };
  // Small solver steps stay stable after a delayed animation frame.
  const steps = Math.max(1, Math.ceil(seconds / 0.004));
  const dt = seconds / steps;
  for (let step = 0; step < steps; step++) {
    velocity +=
      ((target - value) * spring.stiffness - velocity * spring.damping) * dt;
    value += velocity * dt;
  }
  return { value, velocity };
}

export function tabLensShape(lift: number, stretch: number, reduced: boolean) {
  if (reduced) return { rail: 1, width: 1, height: 1, content: 1 };
  return {
    rail: 1 + tokens.railExpansion * lift,
    width: 1 + tokens.lensWidthExpansion * lift + stretch,
    height:
      1 +
      tokens.lensHeightExpansion * lift -
      stretch * tokens.stretchCompression,
    content: 1 + tokens.contentMagnification * lift,
  };
}
