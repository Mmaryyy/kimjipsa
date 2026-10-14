# 김집사 (kimjipsa)

신혼부부가 일정, 재고, 장바구니를 같이 관리하고 AI 집사 챗봇이 조회·실행·제안까지 해 주는 가정 관리 서비스. kimjipsa는 저장소와 패키지에 쓰는 코드명이다.

현재 단계: 개발 착수 전. 기획서·명세(v0.11)와 개발 문서가 있고 `package.json`과 소스 코드는 아직 없다.

## 기준 문서 (Source of Truth)

충돌하면 위에 있는 것이 이긴다. 코드와 문서가 어긋나면 한쪽을 임의로 고치지 말고 원인을 확인해 사용자에게 묻는다.

1. 사용자가 직접 전달한 최신 요구사항
2. 승인된 기획서·기능명세: `docs/기획서.html`, `docs/기능명세.html` (원본은 claude.ai 아티팩트, URL은 `docs/README.md`)
3. 승인된 기술 결정: `docs/02-architecture/ADR/`
4. 개발 가이드라인: `docs/03-guidelines/`
5. 기존 구현 코드

요구사항 ID 접두사는 `CAL`(일정), `INV`(재고), `CART`(장바구니), `BOT`(챗봇), `ACC`(가정·계정)이다. 코드, 커밋, 이슈에서는 이 ID(예: `CAL-03`)로 요구사항을 가리킨다. 확인 시나리오는 `SCN-<영역>-<번호>`이다.

상태 표기: `CONFIRMED`(확정), `PROPOSED`(AI 제안, 승인 전), `PENDING`(결정 필요). PROPOSED·PENDING 항목은 구현의 전제로 삼지 않는다.

## 문서 탐색

필요한 문서만 읽는다. 요구사항 원문은 항상 `docs/기능명세.html`이 우선이고 `REQUIREMENTS.md`는 색인이다.

| 작업 | 읽을 문서 |
| --- | --- |
| 신규 기능 | `docs/01-project/REQUIREMENTS.md`, 명세 원문, `docs/02-architecture/ARCHITECTURE.md` |
| 파일 생성·이동, 코드 위치 결정 | `docs/02-architecture/FSD.md` |
| 코드 작성·수정 (기획·문서 작업에는 읽지 않음) | `docs/03-guidelines/CODING_STANDARDS.md` |
| UI·컴포넌트 | `docs/03-guidelines/DESIGN_SYSTEM.md`, `CODING_STANDARDS.md` |
| API·서버 라우트 | `docs/03-guidelines/API_CONVENTIONS.md` |
| 스키마·데이터 | `docs/02-architecture/DATA_MODEL.md` |
| 상태 관리 | `docs/03-guidelines/STATE_MANAGEMENT.md` |
| 테스트 | `docs/03-guidelines/TESTING.md` |
| 기술 변경·도입 | `docs/02-architecture/TECH_STACK.md`, `ADR/` |
| 용어 | `docs/01-project/GLOSSARY.md` |
| 일정·우선순위 | `docs/04-planning/ROADMAP.md` |
| 미결 사항 | `docs/04-planning/DECISIONS_REQUIRED.md` |

문서 전체 목록과 아티팩트 URL은 `docs/README.md`.

## 확정된 주요 결정

- MVP는 모바일 우선 PWA(Next.js, Supabase, Vercel)로 만든다.
- 코드 구조는 FSD(Feature-Sliced Design)를 따른다. 파일을 새로 만들거나 옮길 때는 `docs/02-architecture/FSD.md`를 읽는다.
- AI는 BYOK이다. 관리자가 Claude 또는 Gemini 키를 하나 등록하고 가정 전체가 공유한다. 키는 서버에서 암호화해 저장한다.
- AI와 외부 API 호출은 모두 서버 라우트를 거치고, 데이터는 항상 요청자 권한으로 걸러서 내려보낸다.
- 개인 일정의 제목·장소·메모는 화면과 챗봇 어디에서도 배우자에게 나가지 않는다.
- 사용자가 직접 요청한 변경은 바로 실행하고, 챗봇이 스스로 판단한 변경만 채팅 안의 확인 버튼을 거친다.
- 한 사용자는 한 가정에만 속하고, 가정 인원 제한은 없다. 초대 링크는 1회용이며 3일 뒤 만료된다.

- 언어·UI·날짜는 TypeScript strict, Tailwind + CVA, shadcn/ui, date-fns(타임존 `Asia/Seoul` 고정)다(ADR-0004).
- 서버 상태는 TanStack Query, 검증은 Zod다(ADR-0005). 테스트는 Vitest + Testing Library + Playwright다(ADR-0006).
- 패키지 매니저는 Yarn 4(`nodeLinker: node-modules`)다(ADR-0007).

그 밖의 기술(폼 라이브러리, 전역 스토어, 예약 작업, 키 암호화 등)은 `docs/02-architecture/TECH_STACK.md`에서 PROPOSED/UNDER_REVIEW 상태이며 승인 전에 확정된 것처럼 쓰지 않는다.

## 개발 규칙

- 요구사항에 없는 기능을 임의로 추가하지 않는다. 기존 요구사항과 충돌하는 구현을 하지 않는다.
- 사용자가 결정해야 하는 항목이 남아 있으면(기획서 §12, 명세의 "정해야 할 것", `DECISIONS_REQUIRED.md`) 추측해서 구현하지 않고 묻는다.
- 문서와 구현이 어긋나면 임의로 판단하지 말고 사용자에게 확인한 뒤 문서를 먼저 고친다.
- 변경 범위를 최소화하고 불필요한 의존성을 추가하지 않는다. 타입 안정성을 유지한다.
- 중요한 기술 결정은 승인을 받은 뒤 ADR로 기록한다. 승인되지 않은 제안을 ADR이나 CONFIRMED로 쓰지 않는다.

## 작업 흐름

1. 요청 분석 → 2. 관련 요구사항 ID 탐색 → 3. 관련 문서 확인 → 4. 기존 구현 확인 → 5. 구현 계획 → 6. 필요한 결정 확인 → 7. 코드 작성 → 8. 검증(아래 규칙에 따라 승인 후) → 9. 결과 보고

반복 작업용 스킬은 `.agents/skills/`에 있다(`implement-feature`, `create-component`, `code-review`, `write-tests`). `.claude/skills`는 이 폴더를 가리키는 심볼릭 링크다.

## 문서 운영 규칙

- 아티팩트(claude.ai)가 원본이고 `docs/`의 기획서·명세 HTML은 복사본이다. 문서를 고치면 양쪽을 함께 맞춘다. 사용자 요청 없이 기획서·명세 원본을 수정하지 않는다.
- 요구사항, 구조, 규칙, 결정이 실제로 바뀔 때만 관련 문서를 갱신한다. 단순한 코드 수정마다 문서를 고치지 않는다.
  - 기획서·명세 변경 → `REQUIREMENTS.md`, `DATA_MODEL.md`, `ROADMAP.md`
  - 승인된 구조 변경 → `ARCHITECTURE.md`, ADR
  - 기술 확정·변경 → `TECH_STACK.md`와 해당 가이드라인
  - 디자인 변경 → `DESIGN_SYSTEM.md`
- 결정이 나면 `DECISIONS_REQUIRED.md`의 Status를 바꾼다.

## 작업 규칙

- 사용자 승인 없이 테스트, 빌드, 검증 스크립트, 코드 리뷰 같은 워크플로를 돌리지 않는다. 예외로 코드 포매팅은 승인 없이 기본으로 돌린다. 코드 작업을 마칠 때는 묻지 않고 `yarn format`을 돌린 뒤 `yarn format:check`가 통과하는지 확인하고 끝낸다. 통과하지 못하면 작업이 끝난 것이 아니다. 포매팅은 이번 작업에서 새로 쓰거나 고친 파일에만 적용한다. (`package.json`이 생기기 전이거나 문서만 바꾼 작업에는 해당하지 않는다.)
- 마이그레이션, 인증·권한, 결제, 배포 설정, 환경 변수·시크릿, 대량 삭제·이동, 되돌리기 어려운 작업을 마칠 때는 끝내기 전에 검증할지 한 줄 근거와 함께 먼저 제안한다.

## 코드 컨벤션

코드를 새로 쓰거나 고칠 때만 `docs/03-guidelines/CODING_STANDARDS.md`를 읽는다. 구조(FSD 상세는 `docs/02-architecture/FSD.md`), 컴포넌트 재사용, 네이밍, 타입, 스타일, 가독성, 커밋 메시지 규칙이 들어 있다. 기획·문서 작업에는 읽지 않는다.
