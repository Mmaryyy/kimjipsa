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
      "these supported tasks in Korean: 일정 등록·수정·삭제·조회, 재고 확인과 수량 변경, 장바구니 담기·체크·삭제, " +
        "프로젝트 조회·할 일 추가와 완료·지출 기록.",
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
  it("INV-11 SCN-BOT-5 여러 품목의 카테고리는 각각 고르고 위치와 단위는 되물어요", () => {
    expect(instructions).toContain(
      "Never ask for inventory category. For each new item choose the exact category_id",
    );
    expect(instructions).toContain("use the exact 기타 ID when unsure");
    expect(instructions).toContain("existing category on edits and merges");
    expect(instructions).toContain(
      "If mode, location, or required unit is missing",
    );
    expect(instructions).toContain("2-6 choices using exact household IDs");
  });

  it("CART-11 SCN-BOT-5 수량을 수정할 때 카테고리를 되묻지 않아요", () => {
    expect(instructions).toContain(
      "Never ask for cart category on add, edit, delete, or check",
    );
    expect(instructions).toContain("that best matches each item name");
    expect(instructions).toContain(
      "keep the existing category_id, or choose one by name if empty",
    );
    expect(instructions).toContain(
      "Delete and check payloads have no category_id",
    );
    expect(instructions).toContain('value:"merge"');
    expect(instructions).toContain('value:"separate"');
  });
  it("CART-07 INV-12 SCN-BOT-6 새 재고 반영에서 보관 위치와 단위만 되물어요", () => {
    expect(instructions).toContain(
      "for new stock use the cart item's category_id or choose by item name (exact 기타 ID when unsure). " +
        "Ask only for missing location or unit for new stock.",
    );
  });
});
