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
| AI 제공자 | Claude, Gemini (BYOK, 가정당 하나) | CONFIRMED | `AGENTS.md`, 기획서 §06, §12. 제공자 차이는 어댑터 한 겹으로 감쌈 |
| 외부 연동 | Google Calendar API (읽기+쓰기, M3) | CONFIRMED | CAL-15 |
| 폴더 구조 | Feature-Sliced Design | CONFIRMED | `AGENTS.md`, 기획서 §09. 상세는 `FSD.md` |
| 경계 강제 | `eslint-plugin-boundaries` 7.2.0 | CONFIRMED | ADR-0008, FSD.md §7. 레이어·슬라이스·public API와 entity `@x` 타입 예외 |
| 포매터 | Prettier | CONFIRMED | `AGENTS.md`(`yarn format` / `format:check`), `CODING_STANDARDS.md` §8 |
| 패키지 매니저 | Yarn 4, `nodeLinker: node-modules` | CONFIRMED | ADR-0007. corepack + `packageManager` 필드로 버전 고정 |
| 언어 | TypeScript (strict) | CONFIRMED | ADR-0004 (DEC-002) |
| 스타일링 | Tailwind CSS + `class-variance-authority` + `cn()` | CONFIRMED | ADR-0004. 테마는 `docs/design/tokens.css`의 CSS 변수를 가리킴 |
| UI 프리미티브 | shadcn/ui (Radix 기반). 현재는 `radix-ui` 통합 패키지를 직접 쓰고 `kj-*` CSS로 외형을 입힘 | CONFIRMED | ADR-0004. 외형은 `docs/design/HANDOFF.md`에 맞춤. shadcn CLI가 만든 파일은 아직 없고(`components.json`만 있음) 추가할 때는 `shared/ui` 규칙(`README.md`)을 따른다 |
| 아이콘 | `lucide-react` (shadcn/ui 기본 아이콘 라이브러리) | CONFIRMED | 사용자 결정(2026-10-15, P0 코드 리뷰 r002-f1): shadcn 기본값을 따르고 바꾸지 않는다. `components.json`의 `iconLibrary: "lucide"`. P1 이후 아이콘을 쓰는 컴포넌트에서 사용 |
| 날짜 | date-fns, 타임존 `Asia/Seoul` 고정(MVP) | CONFIRMED | ADR-0004 |
| 서버 상태 | TanStack Query + Supabase Realtime 구독으로 캐시 갱신 | CONFIRMED | ADR-0005 (DEC-006) |
| 검증 | Zod (서버 라우트·클라이언트 공유 스키마) | CONFIRMED | ADR-0005 |
| 단위·컴포넌트 테스트 | Vitest + Testing Library | CONFIRMED | ADR-0006 (DEC-007) |
| E2E 테스트 | Playwright | CONFIRMED | ADR-0006. CI 구성은 별도 승인 |

## 제안 스택 (승인 필요)

| 영역 | 추천 | 상태 | 추천 이유 | 대안 | 단점·주의 | 결정 |
| --- | --- | --- | --- | --- | --- | --- |
| 폼 라이브러리 | React Hook Form | UNDER_REVIEW | 일정·재고·가정 설정 폼이 많음. Zod는 확정(ADR-0005) | 직접 상태 + Zod만 | 폼이 단순하면 과할 수 있음. 일정 등록 폼 구현 전에 다시 정함 | DEC-006 |
| 클라이언트 전역 상태 | 필요할 때만 entity `model/`에 작은 스토어(예: Zustand) | UNDER_REVIEW | 서버 상태가 대부분이라 전역 스토어 필요가 작음 | Context | 챗봇 창 열림/최소화 등 UI 상태가 후보 | DEC-006 |
| 웹 푸시 발송 | Web Push 프로토콜(VAPID) + `web-push` 라이브러리, 서버 라우트에서 발송 | PROPOSED | 추가 비용 없음(기획서 §06). iOS는 설치한 PWA만 지원 | FCM | VAPID 키가 시크릿 | DEC-004 |
| 예약 작업 | Supabase `pg_cron`(+ Edge Function/DB 함수) 또는 Vercel Cron | UNDER_REVIEW | 사용자별 아침 요약 시각, 일정별 시작 전 알림, 5분 무활동 후 기억 요약, 90일 삭제를 처리할 스케줄러가 필요. Vercel 무료 플랜 Cron은 빈도 제한이 있으므로 플랜 확인 필요 | 외부 스케줄러 | 가장 큰 미결 인프라 | DEC-004 |
| AI 호출 계층 | 직접 어댑터(Claude/Gemini 공식 SDK 또는 REST를 `AiProvider` 인터페이스로 감쌈) | PROPOSED | 지원이 두 곳뿐이라 얇은 어댑터로 충분(기획서 §09). 도구 호출·OCR 차이는 어댑터 안에서 흡수 | Vercel AI SDK | 제공자별 도구 호출 형식 차이를 직접 맞춰야 함 | DEC-012 |
| 키 암호화 | 서버에서 AES-GCM 등 인증 암호화, 마스터 키는 환경 변수 / 또는 Supabase Vault | UNDER_REVIEW | 요구는 "서버에서 암호화 저장, 화면엔 끝자리만"(ACC-08) | pgsodium, KMS | 키 교체·유출 대응 절차 필요. 보안 항목이라 승인 필수 | DEC-003 |
| 오류 모니터링 | 미정 | PENDING | 기획서 §11이 "에러 모니터링"을 요구하지만 도구 언급 없음 | Sentry 등 | 외부 서비스 비용·개인정보 | DEC-013 |
| 파일 저장소 | 미정 | PENDING | 영수증 이미지(M3, INV-17)를 저장할지 처리 후 폐기할지 미정 | Supabase Storage | 개인정보 | DEC-011 |

## 채택하지 않기로 한 것

| 항목 | 상태 | 이유 |
| --- | --- | --- |
| 모든 API 호출을 거치는 Zustand 스토어 필수 계층(`api → store → hook`) | REJECTED | 이 프로젝트는 Realtime과 서버 라우트를 쓰므로 스토어는 필요할 때만 entity `model/`에 둔다 (`CODING_STANDARDS.md` "옮기지 않은 것") |
| 종류별 최상위 폴더(`api/`, `stores/`, `hooks/`, `components/`) | REJECTED | FSD 레이어로 대체 |
| `processes` FSD 레이어 | REJECTED | `FSD.md` §1 |
| 브라우저에서 AI·구글 캘린더 직접 호출 | REJECTED | 키 노출 방지와 질문자 권한 필터링을 위해 서버 라우트만 사용 (기획서 §09) |
| 계정 합치기(카카오+구글 동일 이메일) | REJECTED | 명세 확정 정책: 로그인 수단별 별개 계정 |

## 구조 확정 사항 요약

- 브라우저는 로그인과 실시간 구독만 Supabase에 직접 연결한다. 그 외 AI, 구글 캘린더, 권한 필터링이 필요한 조회는 서버 라우트를 거친다. (기획서 §09)
- 데이터는 항상 요청자 권한으로 걸러서 내려보낸다. (`AGENTS.md`)

## P0 설치 버전

- Yarn 4.18.1 (`nodeLinker: node-modules`), Node.js 22.12 이상
- Next.js 16.4.1, React 19.3.1, TypeScript 6.0.3 (`strict`)
- Tailwind CSS 4.3.3, CVA 0.7.1, shadcn/ui 수동 초기화(`components.json`)
- radix-ui 1.8.1 (P1 추가. Checkbox·Switch·ToggleGroup·Dialog·AlertDialog·Toast에서 사용)
- ESLint 9.39.5, eslint-plugin-boundaries 7.2.0, Prettier 3.9.10
- Vitest 5.0.4, Testing Library React 16.3.3, Playwright 1.64.1
- date-fns·TanStack Query·Zod·Supabase는 사용하는 Phase에서 설치한다.
