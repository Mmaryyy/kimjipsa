# 기술 스택

| 상태 | 뜻 |
| --- | --- |
| `CONFIRMED` | 승인된 기술. 근거(기획서, `AGENTS.md`의 확정 결정)를 적는다 |
| `PROPOSED` | AI가 제안한 기술. 승인 전에는 이 기술을 전제로 강제 규칙을 만들지 않는다 |
| `UNDER_REVIEW` | 검토 중 |
| `REJECTED` | 채택하지 않기로 한 기술 |

PROPOSED 항목은 `docs/04-planning/DECISIONS_REQUIRED.md`의 결정 번호와 연결한다. 승인되면 확정 표로 옮기고 `ADR/`에 기록한다. P0 설치 버전은 아래에 기록하고 전체 의존성의 정확한 버전은 `package.json`과 `yarn.lock`으로 고정한다.

## 확정된 스택

| 영역 | 기술 | 상태 | 근거·이유 |
| --- | --- | --- | --- |
| 프론트엔드 프레임워크 | Next.js (React) | CONFIRMED | `AGENTS.md`, 기획서 §09. PWA, 서버 라우트(권한 필터링, AI 호출)를 한 코드베이스에서 처리 |
| 앱 형태 | PWA (웹 매니페스트, 서비스 워커, 웹 푸시) | CONFIRMED | 기획서 §04, ACC-17. 앱스토어 없이 홈 화면 설치 |
| 백엔드·DB | Supabase: Postgres(RLS), Auth, Realtime | CONFIRMED | `AGENTS.md`, 기획서 §09. 장바구니 실시간 동기화(CART-02), 카카오·구글 로그인(ACC-01) |
| 배포 | Vercel | CONFIRMED | `AGENTS.md`, 기획서 §09 |
| 인증 수단 | 카카오, 구글 (애플은 v1.1) | CONFIRMED | ACC-01, ACC-16 |
| AI 제공자 | 맥미니 Hermes 기본 모델·인증 자동 사용 | CONFIRMED | 2026-11-04 사용자 지시, ADR-0017. 앱 BYOK 대체 |
| 외부 연동 | Google Calendar API (읽기+쓰기, M3) | CONFIRMED | CAL-15 |
| 폴더 구조 | Feature-Sliced Design | CONFIRMED | `AGENTS.md`, 기획서 §09. 상세는 `FSD.md` |
| 경계 강제 | `eslint-plugin-boundaries` 7.2.0 | CONFIRMED | ADR-0008, FSD.md §7. 레이어·슬라이스·public API와 entity `@x` 타입 예외 |
| 포매터 | Prettier | CONFIRMED | `AGENTS.md`(`yarn format` / `format:check`), `CODING_STANDARDS.md` §8 |
| 패키지 매니저 | Yarn 4, `nodeLinker: node-modules` | CONFIRMED | ADR-0007. corepack + `packageManager` 필드로 버전 고정 |
| 언어 | TypeScript (strict) | CONFIRMED | ADR-0004 (DEC-002) |
| 스타일링 | Tailwind CSS + `class-variance-authority` + `cn()` | CONFIRMED | ADR-0004. 테마는 `docs/design/tokens.css`의 CSS 변수를 가리킴 |
| UI 프리미티브 | shadcn/ui (Radix 기반). 현재는 `radix-ui` 통합 패키지를 직접 쓰고 `kj-*` CSS로 외형을 입힘 | CONFIRMED | ADR-0004. 외형은 `docs/design/HANDOFF.md`에 맞춤. shadcn CLI가 만든 파일은 아직 없고(`components.json`만 있음) 추가할 때는 `shared/ui` 규칙(`README.md`)을 따른다 |
| 아이콘 | `lucide-react` (shadcn/ui 기본 아이콘 라이브러리) | CONFIRMED | 사용자 결정(2026-10-15, P0 코드 리뷰 r002-f1): shadcn 기본값을 따르고 바꾸지 않는다. `components.json`의 `iconLibrary: "lucide"`. P1 이후 아이콘을 쓰는 컴포넌트에서 사용 |
| 축하 색종이 | `canvas-confetti` 1.9.4 | CONFIRMED | 사용자 요청(2026-10-19, CAL-16): 축하 카드 색종이, 약 4.4KB gzip. 홈에서 동적 로드하고 동작 줄이기·숨은 탭에서는 중지 |
| 목록 순서 변경 | `@dnd-kit/core` 6.3.1 · `@dnd-kit/sortable` 10.0.0 · `@dnd-kit/utilities` 3.2.2 | CONFIRMED | 사용자 결정(2026-10-19, P4.9): 손잡이 드래그와 터치·키보드 정렬, 기존 카테고리 저장 RPC 사용 |
| 모바일 일정 폼 | `vaul` 1.1.2 (정확한 버전) | CONFIRMED | 사용자 승인(2026-10-21, P5.5 r111-f1). [유지보수 중단](https://github.com/emilkowalski/vaul) 상태를 알고 채택. shadcn Drawer 구성의 `shared/ui/drawer.tsx` 한 곳에서 감싸 교체 가능하게 유지. `(pointer: coarse)` 일정 추가·수정 폼만 적용하고 휠은 기존 Sheet 유지 |
| 모바일 날짜·시간 휠 | `@ncdai/react-wheel-picker` 1.2.3 | CONFIRMED | 사용자 지시(2026-10-21, P5.5): 필요한 라이브러리 적용. `shared/ui` 래퍼와 기존 Sheet 사용, `(pointer: coarse)`에서만 휠 선택 |
| 범용 유틸 | `lodash-es` 4.18.1 · `@types/lodash-es` 4.17.12 | CONFIRMED | 사용자 결정(2026-10-22): 직접 구현한 유틸을 대체할 수 있고 앞으로 쓸 곳이 많음. ES 모듈판이라 쓴 함수만 번들에 들어감. `lodash`(CommonJS)는 쓰지 않고 `lodash-es`에서 named import(`CODING_STANDARDS.md` §4) |
| 날짜 | date-fns, 타임존 `Asia/Seoul` 고정(MVP) | CONFIRMED | ADR-0004 |
| 서버 상태 | TanStack Query + Supabase Realtime 구독으로 캐시 갱신 | CONFIRMED | ADR-0005 (DEC-006) |
| 검증 | Zod (서버 라우트·클라이언트 공유 스키마) | CONFIRMED | ADR-0005 |
| 단위·컴포넌트 테스트 | Vitest + Testing Library | CONFIRMED | ADR-0006 (DEC-007) |
| E2E 테스트 | Playwright | CONFIRMED | ADR-0006. CI 구성은 별도 승인 |

## 제안 스택 (승인 필요)

| 영역 | 추천 | 상태 | 추천 이유 | 대안 | 단점·주의 | 결정 |
| --- | --- | --- | --- | --- | --- | --- |
| 폼 라이브러리 | React Hook Form + @hookform/resolvers(Zod) | CONFIRMED | 일정·재고·가정 설정 폼이 많음. Zod는 확정(ADR-0005) | 직접 상태 + Zod만 | 번들에 의존성 2개가 늘어남. 폼이 있는 화면에서만 로드 | DEC-006, ADR-0011 |
| 클라이언트 전역 상태 | 필요할 때만 entity `model/`에 작은 스토어(예: Zustand) | UNDER_REVIEW | 서버 상태가 대부분이라 전역 스토어 필요가 작음 | Context | 챗봇 창 열림/최소화 등 UI 상태가 후보 | DEC-006 |
| 웹 푸시 발송 | Web Push 프로토콜(VAPID) + `web-push` 3.6.7(서버 전용), 서버 라우트에서 발송 | CONFIRMED | 사용자 승인 2026-10-21. 추가 비용 없음(기획서 §06). iOS는 설치한 PWA만 지원 | FCM | VAPID 키가 시크릿 | DEC-004 |
| 예약 작업 | Supabase `pg_cron`(1분) + `pg_net`으로 서버 라우트 호출 | CONFIRMED | 사용자별 아침 요약 시각, 일정별 시작 전 알림, 이후 대화 요약·90일 삭제. Vercel 무료 플랜 Cron은 빈도 제한 | Vercel Cron, 외부 스케줄러 | 호출 시크릿 관리, Supabase 확장 켜기 필요 | DEC-004, ADR-0013 |
| 공휴일 데이터 | 공공데이터포털 특일정보 API(`getRestDeInfo`), 서버 라우트 + 연도별 캐시 | CONFIRMED | 공식 출처라 대체·임시공휴일 반영. 테이블 없음 | 내장 목록, 구글 공휴일 캘린더 | 서비스 키가 시크릿. 실패 시 공휴일 없이 동작 | DEC-015, ADR-0014 |
| 달력 스와이프 | `embla-carousel-react` 8.6.0 | CONFIRMED | 손가락을 따라 끌리는 월·주·일 넘김. 달력 자체는 직접 구현 유지 | 직접 구현, 캘린더 전체 라이브러리 | 의존성 1개 | ADR-0015 |
| AI 호출 계층 | 직접 어댑터(Claude/Gemini 공식 SDK 또는 REST를 `AiProvider` 인터페이스로 감쌈) | PROPOSED | 지원이 두 곳뿐이라 얇은 어댑터로 충분(기획서 §09). 도구 호출·OCR 차이는 어댑터 안에서 흡수 | Vercel AI SDK | 제공자별 도구 호출 형식 차이를 직접 맞춰야 함 | DEC-012 |
| 모델 인증 | Hermes 로컬 인증 저장소 | CONFIRMED | 사용자 지시, ADR-0017. 앱 키 등록·암호화 사용 중단 | 이전 AES-GCM(ADR-0016) | 앱·DB에 모델 키 전송 없음 | DEC-003 |
| 오류 모니터링 | Vercel 기본 로그(Functions/Runtime Logs). 서버 오류를 개인정보 없이 한 형식으로 남긴다 | CONFIRMED | 사용자 결정 2026-10-30. 새 의존성·외부 전송 없음 | Sentry | 알림이 없고 무료 플랜은 보관 기간이 짧다 | DEC-013 |
| 오류 모니터링 확장 | Sentry(`@sentry/nextjs`) 무료 플랜 | PROPOSED | 나중에 오류 알림·스택 묶기가 필요할 때. 붙일 때 결정할 것: DSN·인증 토큰(시크릿), `beforeSend`로 이메일·일정 내용 같은 개인정보 제거, 소스맵 업로드, 개인정보처리방침의 처리 위탁에 Sentry 추가 | Vercel 로그 유지 | 오류 정보가 외부 서비스로 전송됨 | DEC-013 |
| DB 백업 | 미구현 (`docs/04-planning/BACKUP_PLAN.md`) | PENDING | 사용자 결정 2026-10-30: 지금은 문서로만 남긴다 | GitHub Actions pg_dump, Supabase Pro, 수동 덤프 | 백업이 없는 동안 데이터 손실 시 복구 불가 | DEC-013 |
| CI | GitHub Actions(PR·push): typecheck·lint·lint:canary·test·format:check | CONFIRMED | 사용자 결정 2026-10-30. 배포는 Vercel이 맡는다 | 없음 | Actions 무료 사용량 | DEC-013 |
| 파일 저장소 | 미정 | PENDING | 영수증 이미지(M3, INV-17)를 저장할지 처리 후 폐기할지 미정 | Supabase Storage | 개인정보 | DEC-011 |

## 채택하지 않기로 한 것

| 항목 | 상태 | 이유 |
| --- | --- | --- |
| 모든 API 호출을 거치는 Zustand 스토어 필수 계층(`api → store → hook`) | REJECTED | 이 프로젝트는 Realtime과 서버 라우트를 쓰므로 스토어는 필요할 때만 entity `model/`에 둔다 (`CODING_STANDARDS.md` "옮기지 않은 것") |
| 종류별 최상위 폴더(`api/`, `stores/`, `hooks/`, `components/`) | REJECTED | FSD 레이어로 대체 |
| `processes` FSD 레이어 | REJECTED | `FSD.md` §1 |
| 브라우저에서 AI 직접 호출 | REJECTED | 키 노출 방지와 질문자 권한 필터링을 위해 서버 라우트만 사용 (기획서 §09) |
| 계정 합치기(카카오+구글 동일 이메일) | REJECTED | 명세 확정 정책: 로그인 수단별 별개 계정 |

## 구조 확정 사항 요약

- 브라우저는 로그인과 실시간 구독만 Supabase에 직접 연결한다. 그 외 AI, 권한 필터링이 필요한 조회는 서버 라우트를 거친다. (기획서 §09)
- 데이터는 항상 요청자 권한으로 걸러서 내려보낸다. (`AGENTS.md`)

## P0 설치 버전

- Yarn 4.18.1 (`nodeLinker: node-modules`), Node.js 22.12 이상
- Next.js 16.4.1, React 19.3.1, TypeScript 6.0.3 (`strict`)
- Tailwind CSS 4.3.3, CVA 0.7.1, shadcn/ui 수동 초기화(`components.json`)
- radix-ui 1.8.1 (P1 추가. Checkbox·Switch·ToggleGroup·Dialog·AlertDialog·Toast에서 사용)
- ESLint 9.39.5, eslint-plugin-boundaries 7.2.0, Prettier 3.9.10
- Vitest 5.0.4, Testing Library React 16.3.3, Playwright 1.64.1
- date-fns·TanStack Query·Zod·Supabase는 사용하는 Phase에서 설치한다.

## 2026-11-04 가족 집사 연동

가족 집사 실행은 설치된 Hermes 실행기 + Node TypeScript 워커, 전달은 Supabase pgmq Basic Queue + 비공개 Realtime으로 확정했다(사용자 구현 요청, ADR-0017). 모델 호출은 Hermes가 담당하며 Vercel AI Gateway/AI SDK 의존성을 추가하지 않는다.
