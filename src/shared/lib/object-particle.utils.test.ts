import { describe, expect, it } from "vitest";
import { objectParticle } from "./object-particle.utils";

describe("INV-04 CART-03 목적격 조사", () => {
  it.each([
    ["고추장", "을"],
    ["우유", "를"],
    ["milk", "를"],
    ["우유2", "를"],
  ])("%s 뒤에 %s을 붙여요", (name, particle) => {
    expect(objectParticle(name)).toBe(particle);
  });
});
