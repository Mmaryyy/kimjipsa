// @vitest-environment node
import { describe, expect, it } from "vitest";
import { householdInstructions } from "./instructions.mts";
const instructions = householdInstructions.replace(/\s+/g, " ");
describe("BOT-07/08 INV-11 CART-11 worker contract", () => {
  it("requires one confirmation for all mutations, including direct requests", () => {
    expect(instructions).toContain(
      "For ALL mutations return kind=action_proposal",
    );
    expect(instructions).not.toContain("For direct explicit mutations");
    expect(instructions).not.toContain("5-minute");
    expect(instructions).toContain("Cancelled proposal values are discarded");
  });
  it("asks for exact inventory metadata and duplicate choices, while cart category stays automatic", () => {
    expect(instructions).toContain(
      "If mode, category, location, or required unit is missing",
    );
    expect(instructions).toContain("2-6 choices using exact household IDs");
    expect(instructions).toContain('value:"merge"');
    expect(instructions).toContain('value:"separate"');
    expect(instructions).toContain("Never ask for cart category");
    expect(instructions).toContain(
      "P10.11 matching name, AI suggestion, then 기타",
    );
  });
});
