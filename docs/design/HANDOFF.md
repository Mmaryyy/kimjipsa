# 디자인 → 구현 인계

김집사 디자인 시스템과 화면 프로토타입을 구현 에이전트에게 넘기는 문서다. 구현을 시작하기 전에 이 문서를 먼저 읽는다.

- 디자인 원본: Open Design 프로젝트 `03d70b5b-0764-4b26-9716-aa0c215bfcac` (2026-10-14 기준으로 이 폴더에 복사함)
- 디자인을 고치면 원본에서 고친 뒤 이 폴더를 다시 복사한다. 이 폴더의 파일을 직접 고치지 않는다.

## 1. 읽는 순서

1. 이 문서
2. `DESIGN.md` — 컬러·타이포·모양·레이아웃·컴포넌트·문구 규칙 (디자인 기준 원본)
3. `prototype/components.html` — 토큰과 컴포넌트를 라이트·다크로 나란히 보여 주는 카탈로그. 브라우저로 연다.
4. `prototype/index.html` — 화면 목록. 각 화면 파일을 열어 동작을 확인한다.
5. `../03-guidelines/DESIGN_SYSTEM.md`, `../03-guidelines/CODING_STANDARDS.md` §6·§7

## 2. 폴더 구성

| 경로                    | 내용                                                             | 구현에서 쓰는 방법                                        |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| `tokens.css`            | 확정 디자인 토큰 (라이트·다크)                                   | **원본.** 앱 토큰 파일로 옮긴다. 값을 다시 만들지 않는다. |
| `DESIGN.md`             | 디자인 규칙 문서                                                 | 판단 기준                                                 |
| `prototype/*.html`      | 화면 프로토타입 (정적 HTML + 바닐라 JS)                          | 참고용. 마크업·스크립트를 그대로 옮기지 않는다.           |
| `prototype/css/app.css` | 프로토타입 컴포넌트 스타일                                       | 컴포넌트 외형(크기·간격·상태)을 읽는 참고 자료            |
| `prototype/js/app.js`   | 공통 동작 (내비, 집사 대화창, 말풍선, 토스트, 확인창, 샘플 목록) | 동작 규칙 참고                                            |
| `prototype/assets/`     | 캐릭터·아이콘 원본                                               | `public/`으로 옮겨 쓴다                                   |

## 3. 토큰 옮기기 (가장 먼저)

`tokens.css`를 앱의 전역 CSS로 옮기고, Tailwind 테마는 이 CSS 변수를 가리키게 한다. 경로가 정해지면 `CODING_STANDARDS.md` §6과 `DESIGN_SYSTEM.md`에 적는다.

- **모드:** 기본은 `prefers-color-scheme`를 따르고, `html[data-theme="light" | "dark"]`로 강제할 수 있다(설정 > 화면 모드). 다크 값은 `[data-theme="dark"]` 블록과 `@media (prefers-color-scheme: dark)` 블록에 같은 값으로 두 번 들어 있다. 옮길 때 둘을 함께 맞춘다.
- **층:** ① Apple 원본 `--sys-*` → ② Apple 시맨틱 `--label-*`, `--bg-*`, `--fill-*` → ③ 김집사 별칭 `--accent`, `--status-*`, `--cat-*`, `--bot`. 컴포넌트는 ②·③만 쓴다.
- **서체:** 스위트(Sweet/SUITE, 눈누 1150) 웹폰트. `@font-face`는 jsDelivr WOFF2를 쓰고, 셀프 호스팅하지 않기로 했다(사용자 결정, 2026-10-15).

### 3.1 상태 variant — `success · info · warning · error`

| 토큰                                  | 용도                                                                |
| ------------------------------------- | ------------------------------------------------------------------- |
| `--{v}`                               | 채우기·아이콘·점                                                    |
| `--{v}-text`                          | 글자 (Apple 대비 강화 값)                                           |
| `--{v}-soft`                          | 배너 배경 틴트                                                      |
| `--{v}-button-bg` / `--{v}-button-fg` | 버튼. 라이트는 채운 색 + 흰 글자, 다크는 tinted(20% 틴트 + 색 글자) |

모드가 고정된 원본 값(`--success-light`, `--success-dark`, `--success-text-light` …)은 `DESIGN.md` §2.4 표에 있다. 화면 코드에서는 원본 값을 직접 쓰지 않는다.

도메인 상태는 variant의 별칭이다: 없음 → `error`, 부족 → `warning`, 반영됨·충분 → `success`, 정보 → `info`. 유통기한 임박(Yellow)과 배우자 개인 일정(Gray)만 4종 밖의 전용 색이다.

### 3.2 타이포 variant

`display · title-lg · title · title-sm · headline · body-lg · body · body-sm · label · caption · caption-sm · caption-xs`

단계마다 `--type-{v}-size`, `-lh`, `-weight`, `-tracking` 토큰이 있다. 크기와 쓰임은 `DESIGN.md` §3 표를 따른다. 기본 본문은 `body`(16px)다. `label`은 버튼·링크·탭·필터 전용이다.

## 4. 공용 컴포넌트 (화면보다 먼저)

`CODING_STANDARDS.md` §6대로 시각 variant는 CVA로 선언한다. 만들기 전에 `shared/ui`, `entities/*/ui`에 이미 있는지 먼저 찾는다.

| 프로토타입                                            | 컴포넌트 (제안 이름)                             | variant / props                                                       |
| ----------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `.t-{variant}`                                        | `Text`                                           | `variant`: 타이포 12단계                                              |
| `.status[data-variant]`                               | `StatusBadge`                                    | `variant`: success·info·warning·error                                 |
| `.status[data-tone]`                                  | 재고·일정 entity 배지                            | 도메인 상태 → 위 variant로 매핑 (+ expiring, private)                 |
| `.banner[data-variant]`                               | `Banner`                                         | `variant` + 아이콘 + 굵은 첫 문장                                     |
| `.btn`, `.btn[data-variant]`                          | `Button`                                         | `variant`: primary(accent)·gray·danger·상태 4종 / `size`: sm·md·block |
| `.text-btn`                                           | `TextButton`                                     | `tone`: default·danger / `size`                                       |
| `.segmented`                                          | `Segmented`                                      | 월·주·일, 관리 방식                                                   |
| `.filters`                                            | `FilterTabs`                                     | 밑줄 선택, 가로 스크롤                                                |
| `.switch`, `.check`                                   | `Switch`, `Checkbox`                             | iOS 모양                                                              |
| `.stepper`                                            | `QuantityStepper`                                | INV-15                                                                |
| `.field-row`                                          | `FieldRow`                                       | 라벨 왼쪽 · 값 오른쪽, `invalid`                                      |
| `.list > li`, `.row`, `.group-label`, `.section-head` | `List`, `ListRow`, `GroupLabel`, `SectionHeader` | 구분선 없음                                                           |
| `.cat.*`                                              | `CategoryDot`                                    | 사용자가 고른 색 (`--sys-*` 중 하나)                                  |
| `dialog.alert`, `KJ.confirm()`                        | `ConfirmDialog`                                  | 제목에 대상 이름. 일정·품목·일괄 삭제·탈퇴 공용                       |
| `dialog.sheet`                                        | `Sheet`                                          | 모바일 하단 시트, ≥768px 가운데 520px 패널                            |
| `KJ.toast()`                                          | `Toast`                                          | 되돌리기 액션                                                         |
| `.bot-fab` + `.peek`                                  | `BotLauncher`                                    | §6 규칙 참고                                                          |
| `.chat-panel`, `.msg`, `.msg .confirm`                | `ChatPanel`, `ChatMessage`, `InlineConfirm`      | BOT-08 5분 만료                                                       |

## 5. 화면 ↔ 요구사항

요구사항 ID는 `../01-project/REQUIREMENTS.md`, 확인 시나리오는 `docs/기능명세.html` 기준이다. 화면은 ID 단위로 구현한다(implement-feature 스킬).

| 프로토타입        | 화면                                                                         | 요구사항                        |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------- |
| `splash.html`     | 앱 실행 스플래시 → 합류 여부에 따라 홈/시작                                  | ACC-17                          |
| `onboarding.html` | 로그인 → 약관 → 우리 집 만들기 → 초대, 사용된·만료 링크                      | ACC-01~05                       |
| `home.html`       | 오늘: 주간 띠, 오늘 일정, 다가오는 일정, D-day, 확인할 재고, 장바구니 요약   | CAL-06/07/13/16, INV-13, BOT-01 |
| `calendar.html`   | 월·주·일 뷰, 새 일정, 상세·삭제, 배우자 개인 일정 가림                       | CAL-01~13                       |
| `inventory.html`  | 보관 장소별·카테고리별, 검색, +/-, 다 썼어요 → 장바구니                      | INV-01~16, CART-06              |
| `cart.html`       | 코너별 묶음, 공동 체크, 자주 사는 품목, 중복 안내, 오프라인                  | CART-01~14                      |
| `restock.html`    | 재고 반영 확인, 기존 품목 병합 / 새 품목 지정, 반영 없이 닫기                | CART-07/08, INV-12              |
| `chat.html`       | 집사 대화: 기본 메시지·FAQ, 조회, 직접 요청, 판단 변경 확인·만료             | BOT-01~11                       |
| `settings.html`   | 내 정보, 구성원·초대, 알림, 홈 화면, 가정, AI 키·이름, 기억, 화면 모드, 계정 | ACC-07~15, BOT-12~16            |
| `lists.html`      | 일정 카테고리·재고 카테고리·보관 장소·단위 관리 (기본값 + 추가, 색 선택)     | CAL-08, INV-06~08               |

## 6. 지켜야 할 결정 (사용자 피드백으로 확정)

- **구분선 없음.** 목록·섹션·탭 바·시트 어디에도 구분용 border/hairline을 쓰지 않는다. 여백, 글자 위계, 옅은 면 톤으로 나눈다.
- **카드·큰 라운드 없음.** 배경을 칠한 카드, 그림자 타일, 12px 이상 라운드, 왼쪽 색 테두리, 알약 배지, 그라데이션을 쓰지 않는다. Apple 기본 앱 같은 plain 리스트 문법을 따른다.
- **컴팩트한 크기.** 보이는 컨트롤 높이는 28/34/42px이고, 터치 영역은 `::after`로 44px까지 넓힌다.
- **색은 상태와 주 액션에만.** Blue 강조는 한 화면에 주 액션 하나와 선택 표시 정도만 쓴다.
- **집사 챗봇 버튼(BotLauncher)**
  - 오른쪽 아래 `assets/kimjipsa-house.svg`(KIM JIPSA 판자집)를 쓴다.
  - 말풍선은 집 지붕 위 가운데에 붙어서 뜬다. 첫 등장은 6초 뒤, 이후 25~40초 간격으로 4초씩 보인다.
  - 멘트는 `...`, `무엇이든 도와줄 수 있어!`, `오늘 할 일 알려줄까?` 중 랜덤이고, 같은 멘트가 연달아 나오지 않는다.
  - 대화창이 열려 있거나 탭이 숨겨져 있으면 뜨지 않는다. 동작 줄이기에서는 움직임을 끈다.
  - 최소화하면 모바일은 하단 탭 바, 데스크톱은 사이드바로 옮긴다(BOT-01).
- **집사 대화:** 집사·사용자 메시지 모두 말풍선이다. 집사 썸네일은 `kimjipsa-avatar.png`를 하늘색 원형 배경(`#7bc5e8`)에 여백을 두고 크게(48px) 보여 준다.
- **캐릭터·아이콘:** 집사 캐릭터는 `kimjipsa-dog-bird.png`(강아지 집사 + 어깨 위 노란 새)로 확정이다. 앱 아이콘은 이 이미지를 크롭한 `kimjipsa-app-icon-1024.png`를 쓰고, 새로 그리지 않는다.
- **문구:** 해요체로 짧게 쓰고, 버튼은 동사로 끝낸다. 작은 안내·검증 보조 문장은 넣지 않고 오류는 화면 상태로 보여 준다.

## 7. 레이아웃

| 구간     | 구조                                                                     |
| -------- | ------------------------------------------------------------------------ |
| < 768px  | Large Title 머리 + 단일 컬럼 + 하단 탭 바 (오늘·일정·재고·장바구니·설정) |
| ≥ 768px  | 시트는 가운데 520px 패널, 채팅은 오른쪽 아래 400px 패널                  |
| ≥ 1024px | 왼쪽 248px 사이드바 + 본문. 홈·일정은 두 컬럼(1.4 : 1)                   |

360px에서 가로 스크롤이 없어야 한다. 좌우 여백은 모바일 16px, 데스크톱 40px이다.

## 8. 프로토타입에만 있는 것 (구현 대상 아님)

- 샘플 데이터(일정·재고·장바구니·구성원 이름)와 `localStorage` 저장 흉내
- 미리 정해 둔 집사 응답과 가짜 "Claude 연결됨" 상태
- `components.html`의 토큰 표, 견본, 설명 문단 (문서용)
- `index.html`의 화면 목록 (실제 앱 라우팅 아님)
- `icon-preview.html` (아이콘 확인용 페이지)

## 9. 아직 정하지 않은 것

- 라이트 모드 success·warning 채움 버튼은 흰 글자 대비가 약 2:1로 낮다. 라이트도 tinted로 바꿀지 정해야 한다.
- `caption-xs`(11px)는 아직 쓰는 화면이 없다. 하단 탭 바 라벨은 지금 10px로 따로 지정되어 있다.
- 접근성 등급 목표 (`DESIGN_SYSTEM.md` §6 `PENDING` 그대로)
