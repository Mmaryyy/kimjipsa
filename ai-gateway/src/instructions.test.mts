// @vitest-environment node
import { describe, expect, it } from "vitest";
import { householdInstructions } from "./instructions.mts";
const instructions = householdInstructions.replace(/\s+/g, " ");
describe("BOT-07/08 INV-11 CART-11 worker contract", () => {
  it("BOT-09 SCN-BOT-8 범위 밖 질문은 되묻지 않고 가능 기능을 안내해요", () => {
    expect(instructions).toContain(
      "For questions unrelated to household management (stocks, news, general knowledge, etc.) " +
        'without an explicit web search request such as "검색해줘"',
    );
    expect(instructions).toContain(
      "do not answer the topic, ask clarification questions, or search. " +
        "Return kind=reply, awaitingAnswer=false, choices:[]",
    );
    expect(instructions).toContain(
      'text "지원하지 않는 기능이에요. 저는 <supported tasks>을/를 도와드릴 수 있어요."',
    );
    expect(instructions).toContain(
      "these supported tasks in Korean: 일정 등록·수정·삭제·조회, 재고 확인과 수량 변경, 장바구니 담기·체크·삭제.",
    );
    expect(instructions).toContain(
      "For an explicit web search request return kind=search",
    );
  });
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
