// 집사가 할 수 있는 일. 첫 인사 목록과 범위 밖 질문 안내(ai-gateway 지시문)가 같이 쓴다.
export const chatCapabilities = [
  "일정 등록·수정·삭제·조회",
  "재고 확인과 수량 변경",
  "장바구니 담기·체크·삭제",
  "프로젝트 조회·할 일 추가와 완료·지출 기록",
] as const;

export const mockReceiptPhotoId = "4f560b1f-cab4-4522-b5c4-54059f61c103";
