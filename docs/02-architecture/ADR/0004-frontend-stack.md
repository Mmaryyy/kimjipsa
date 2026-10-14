# 0004. 언어·스타일링·UI·날짜: TypeScript + Tailwind/CVA + shadcn/ui + date-fns

- 결정 ID: ADR-0004 (관련 DEC: DEC-002)
- 결정 날짜: 2026-10-14
- 상태: Accepted

## 배경
`CODING_STANDARDS.md`가 TypeScript, Tailwind/CVA, shadcn을 전제로 한 규칙을 조건부로 담고 있었고, 디자인 토큰(`docs/design/tokens.css`)이 CSS 변수로 확정됐다. 날짜 기능(D-day, 월·주·일 뷰, 아침 요약)이 많은데 타임존 기준이 명세에 없다.

## 검토한 대안
- 스타일링: CSS Modules, vanilla-extract
- UI 프리미티브: Radix 직접 사용, Headless UI
- 날짜: dayjs, Temporal 폴리필
- 타임존: 사용자별 저장

## 최종 결정
- 언어: TypeScript `strict`
- 스타일링: Tailwind CSS + `class-variance-authority` + `cn()`(`clsx` + `tailwind-merge`). Tailwind 테마는 `docs/design/tokens.css`를 옮긴 CSS 변수를 가리킨다.
- UI 프리미티브: shadcn/ui(Radix 기반). 외형은 `docs/design/HANDOFF.md` §4·§6에 맞게 고친다.
- 날짜: date-fns. 타임존은 MVP에서 `Asia/Seoul` 고정, 날짜 계산은 한 모듈에 모아 나중에 사용자별 타임존으로 넓힐 수 있게 한다.

## 결정 이유
- 코딩 표준과 디자인 인계 문서가 이미 이 조합을 기준으로 쓰여 있다.
- 확인 대화상자, 시트, 스위치처럼 접근성이 필요한 프리미티브가 많다(CAL-12, INV-14, CAL-03).
- 1차 사용자가 국내 부부라 KST 고정으로 충분하다.

## 예상 영향
- `CODING_STANDARDS.md` §6의 조건부 규칙이 기본 규칙이 된다.
- 앱 토큰 파일 경로는 프로젝트 초기화 때 정해 `DESIGN_SYSTEM.md`, `CODING_STANDARDS.md` §6에 적는다.
- shadcn 컴포넌트 코드가 저장소에 들어오므로 `shared/ui`에 둔다(`FSD.md`).
