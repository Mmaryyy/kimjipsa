import { describe, expect, it } from "vitest";
import { compareItemNames } from "./item-name.utils";
describe("INV-10 INV-16 DEC-010 품목 이름 비교", () => {
  it.each([
    [" Milk Tea ", "milktea", "same"],
    ["우 유", "우유", "same"],
    ["우유", "딸기우유", "similar"],
    ["딸기우유", "우유", "similar"],
    ["우유", "두부", "different"],
    ["", "우유", "different"],
    ["cat", "bat", "different"],
  ])("%s와 %s는 %s", (a, b, expected) => {
    expect(compareItemNames(a, b)).toBe(expected);
  });
});
