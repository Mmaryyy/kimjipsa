# 0005. 서버 상태·검증: TanStack Query + Zod

- 결정 ID: ADR-0005 (관련 DEC: DEC-006)
- 결정 날짜: 2026-10-14
- 상태: Accepted

## 배경
일정·재고·장바구니·대화가 모두 서버 상태이고, 장바구니는 Supabase Realtime으로 공동 편집한다(CART-02). 서버 라우트 입력 검증 도구가 정해지지 않았다.

## 검토한 대안
- 서버 상태: SWR, 직접 훅
- 폼: React Hook Form, 직접 상태
- 전역 UI 상태: Zustand, Context

## 최종 결정
- 서버 상태: TanStack Query. Realtime 이벤트로 캐시를 무효화하거나 갱신한다.
- 검증: Zod. 서버 라우트 입력 검증과 클라이언트 폼 검증이 같은 스키마를 쓴다.
- 폼 라이브러리(React Hook Form 등)는 이번에 정하지 않는다. 폼이 많은 일정·재고·설정 화면을 시작할 때 다시 정한다.
- 전역 UI 스토어(Zustand 등)도 필요해질 때 정한다.

## 결정 이유
로딩·오류·재조회와 낙관적 갱신을 직접 만들지 않아도 되고, 검증 스키마 하나를 서버와 클라이언트가 공유할 수 있다. 폼과 전역 상태는 실제 필요가 보일 때 정하는 편이 의존성을 줄인다.

## 예상 영향
- `STATE_MANAGEMENT.md`, `API_CONVENTIONS.md`의 "제안" 표기를 이 결정에 맞춘다.
- 폼 라이브러리 결정은 일정 등록 폼 구현 전에 다시 묻는다(`TECH_STACK.md` UNDER_REVIEW).
