import { describe, expect, it } from "vitest";
import { isCurrentPath } from "./navigation.utils";

describe("P1 isCurrentPath (기능 SCN 연결 전)", () => {
  it("같은 경로와 하위 경로를 활성화해요", () => {
    expect(isCurrentPath("/cart", "/cart")).toBe(true);
    expect(isCurrentPath("/cart/items", "/cart")).toBe(true);
  });

  it("접두사만 같은 다른 경로는 활성화하지 않아요", () => {
    expect(isCurrentPath("/cart-history", "/cart")).toBe(false);
  });

  it("루트는 정확히 일치할 때만 활성화해요", () => {
    expect(isCurrentPath("/", "/")).toBe(true);
    expect(isCurrentPath("/cart", "/")).toBe(false);
  });
});
