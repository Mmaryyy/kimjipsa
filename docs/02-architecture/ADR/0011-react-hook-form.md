# 0011. 폼: React Hook Form + @hookform/resolvers(Zod)

- 결정 ID: ADR-0011 (관련 DEC: DEC-006, ADR-0005)
- 결정 날짜: 2026-10-16
- 상태: Accepted

## 배경
ADR-0005는 서버 상태(TanStack Query)와 검증(Zod)만 정했고 폼 라이브러리는 "일정 등록 폼 구현 전에 다시 정한다"로 남겼다. P2까지 폼은 프로필·가정 만들기 두 개뿐이라 직접 상태로 충분했지만, 곧 일정 등록(반복·알림·개인/공유 같은 조건부 필드), 품목 폼, 재고 반영 확인 화면(SCN-CART-5), 설정 폼이 이어진다. 사용자가 React Hook Form 도입과 기존 폼까지 한 방식으로 통일하는 것을 승인했다(2026-10-16).

## 검토한 대안
- 직접 상태 + Zod만: 폼마다 상태·오류·제출 중 처리를 반복하게 된다.

## 최종 결정
- `react-hook-form`과 `@hookform/resolvers`를 쓴다. 검증은 Zod 스키마를 `zodResolver`로 연결하고, 서버와 같은 스키마(필요하면 같은 길이 기준)를 공유한다.
- 폼 필드 표시는 `shared/ui`의 `FormFieldRow` 규칙을 따른다. 오류는 해당 필드 근처에 인라인으로 보이고, 필드와 무관한 서버 오류는 폼 아래 `role="alert"`로 보인다.
- 기존 폼(프로필, 가정 만들기)도 같은 방식으로 옮겨 폼 구현을 한 가지로 통일한다.
- `@hookform/resolvers` 5.x는 Zod 3.25 이상과 4를 peer로 지원한다(2026-10-16 npm 확인). 버전은 `package.json`에 고정한다.

## 결정 이유
필드가 많고 서로 연동되는 폼이 앞으로 늘어나고, Zod 스키마를 서버와 폼이 같이 쓸 수 있다.

## 예상 영향
- `TECH_STACK.md`의 폼 라이브러리 항목이 CONFIRMED가 된다. `STATE_MANAGEMENT.md`의 Form State는 이 라이브러리를 기준으로 한다.
- 폼 컴포넌트는 `useForm` + `zodResolver`를 쓰고, 폼 상태를 전역 스토어에 두지 않는다.
- 새 의존성 2개가 번들에 들어간다. 폼이 있는 화면에서만 로드되게 한다.
