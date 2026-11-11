// 집사가 할 수 있는 일. 첫 인사 목록과 범위 밖 질문 안내(ai-gateway 지시문)가 같이 쓴다.
export const chatCapabilities = [
  "일정 등록·수정·삭제·조회",
  "재고 확인과 수량 변경",
  "장바구니 담기·체크·삭제",
] as const;
