# FSD 구조 가이드

파일을 새로 만들거나 옮길 때, 어느 레이어와 슬라이스에 둘지 정할 때 읽는다. 코드 스타일은 `docs/03-guidelines/CODING_STANDARDS.md`를 본다.

김집사는 Feature-Sliced Design(FSD)으로 구성한다. `unas-react` FSD 전환 플랜의 규칙을 기준으로 하되, Next.js와 Supabase에 맞게 고친 부분이 있다. 폴더와 슬라이스 이름은 프로젝트 초기 세팅 때 확정하고, 달라지면 이 문서를 같이 고친다.

## 1. 레이어

import는 위에서 아래로만 한다. 같은 레이어의 다른 슬라이스는 import하지 않는다.

| 레이어 | 두는 것 | import 가능 |
| --- | --- | --- |
| `app` | 프로바이더, 전역 스타일, PWA 등록(서비스 워커), 앱 셸(내비게이션, 챗봇 아이콘 위치) | 전부 |
| `pages` | 라우트 화면과 그 화면 전용 ui/model/lib/api | widgets, features, entities, shared |
| `widgets` | 2개 이상 페이지가 쓰는 큰 조합 블록 | features, entities, shared |
| `features` | 데이터가 붙은 사용자 행동 | entities, shared |
| `entities` | 도메인 데이터: api, 상태, 훅, 도메인 배지·카드, 도메인 규칙 | shared (다른 entity는 `@x`로만) |
| `shared` | 도메인을 모르는 것: Supabase 클라이언트, ui, lib, config, 타입 | shared |

`processes` 레이어는 쓰지 않는다.

## 2. 슬라이스와 세그먼트

- **슬라이스**는 레이어 아래 한 단계 폴더다. 예: `entities/event`, `features/event-visibility-toggle`.
- **pages만 예외다.** 라우트가 여러 개인 도메인은 `pages/<domain>/<route>`가 각각 독립 슬라이스다. 나머지 페이지는 `pages/<page>`가 슬라이스다.
- 두 라우트가 함께 쓰는 도메인 로직은 `entities/<domain>/lib`로 내린다.
- **세그먼트**는 `ui/`(화면), `model/`(상태, 훅, 파생 값), `api/`(호출, 타입, 상수), `lib/`(순수 함수), `config/`다. 필요한 것만 만든다.
- `ui/` 안의 컴포넌트는 컴포넌트마다 폴더 하나다(`ui/celebration-cards/index.tsx`, 하위 `Card.tsx`, 테스트 `celebration-cards.test.tsx`). 파일 이름·내보내기 규칙은 `docs/03-guidelines/CODING_STANDARDS.md` §3.
- entities는 `entities/<domain>/{api,model,ui,lib}` 구조로 두고 흐름은 `api → model(상태·훅) → ui`다. 전역 상태 스토어는 필요할 때만 `model/`에 둔다.
- **public API**: 슬라이스 밖에서는 `@/entities/event`처럼 슬라이스의 `index.ts`로만 가져온다. `@/entities/event/api/type` 같은 깊은 import는 금지한다.
- shared 레이어에 한해 `shared/<세그먼트>/<모듈>/index.{ts,tsx}`도 공개 진입점으로 허용한다. 하위 모듈의 내부 파일을 직접 import하는 것은 금지한다.
- 무거운 공용 모듈(서드파티·CSS 부수 효과)은 `shared/<세그먼트>/<모듈>/index.ts` 별도 진입점으로 두고 세그먼트 배럴에는 넣지 않는다(예: `shared/ui/wheel-picker`).
- 슬라이스 안에서는 상대경로(`../api`)를 쓴다. 자기 `index.ts`를 import하면 순환 참조가 생긴다.
- 서버 전용 함수는 슬라이스의 `index.server.ts`를 별도 public API로 쓰고 `app` 레이어에서만 import한다. 클라이언트용 `index.ts`에서는 재export하지 않아 도메인 상수 import가 `server-only`까지 연결되지 않게 한다.
- **entity 사이의 참조**는 `entities/<a>/@x/<b>.ts`로만 한다. 예를 들어 장바구니 항목이 재고 품목 id를 가지면 `entities/cart-item/@x/inventory-item.ts`로 필요한 타입만 내보낸다.
- 페이지는 배럴로 재수출하지 않는다. 무거운 서드파티(에디터, 차트 등)는 여러 모듈을 모으는 배럴에 넣지 않는다.
- 경로 alias는 `@/*` → `src/*` 하나만 쓴다.

## 3. Next.js 연결

Next의 `app/`, `pages/`와 FSD의 `app`, `pages`가 이름이 겹친다. 이렇게 푼다.

- Next 라우트는 프로젝트 루트의 `app/`에 둔다. 라우트 파일은 얇게 유지하고 `src/pages`의 화면을 다시 내보내기만 한다.

  ```tsx
  // app/calendar/page.tsx
  export { CalendarPage as default } from "@/pages/calendar";
  ```

- FSD의 `app` 레이어는 `src/app/`이다. 프로바이더와 전역 스타일은 여기에 두고 루트 `app/layout.tsx`가 가져다 쓴다.
- Next가 `src/pages`를 라우터로 읽지 않도록 프로젝트 루트에 빈 `pages/` 폴더(README만 둠)를 만든다.
- `shared/server`는 서버 전용 Supabase 클라이언트·세션 갱신·범용 라우트 처리의 진입점으로 허용한다. 클라이언트용 `shared/api` 배럴과 분리해 `server-only`가 브라우저로 섞이지 않게 한다. 도메인 오류 코드·문구는 해당 entity의 `api/server.ts`에 둔다. 프록시는 `shared/server/index.proxy.ts`의 별도 public API를 사용해 `next/headers`·라우트 전용 코드를 가져오지 않는다.
- 서버 전용 코드(Supabase 서비스 키, AI 키 복호화, 푸시 발송)는 해당 슬라이스의 `api/` 세그먼트 안에서 `server-only`로 표시한 파일에 둔다. 라우트 핸들러(`app/api/**/route.ts`)는 요청을 받아 그 함수를 호출하기만 한다.
- 개인 일정 필터링(CAL-04, BOT-10)처럼 화면과 챗봇이 함께 쓰는 권한 규칙은 `entities/event`의 서버 함수 한 곳에 둔다. 화면용 조회와 챗봇 도구가 같은 함수를 호출하게 해서, 규칙이 두 군데로 갈라지지 않게 한다.

## 4. 어디에 둘지 판단하는 법

처음부터 완벽히 나누려 하지 않는다. 아래 순서로 묻고, 애매하면 아래쪽 규칙(페이지에서 시작)을 따른다.

### 질문 순서

1. **도메인을 모르는가?** 일정, 재고 같은 말이 코드에 하나도 없고 다른 프로젝트에도 그대로 쓸 수 있으면 `shared`다. 예: Button, 날짜 포맷, Supabase 클라이언트.
2. **도메인의 "명사"인가?** 데이터, 그 데이터의 규칙, 그 데이터를 보여 주는 최소 표현이면 `entities`다. 예: 일정 타입과 개인 일정 필터, 재고 "부족" 판정, 재고 상태 배지.
3. **사용자가 하는 "동사"인가?** 데이터를 바꾸거나 요청하는 행동이면 `features`다. 예: 일정 저장, 다 썼어요, 구매 완료. 이름도 동사로 짓는다(`cart-checkout`).
4. **한 페이지에서만 쓰는가?** 그렇다면 어느 레이어에도 올리지 말고 그 `pages/<page>` 안에 둔다.
5. **두 페이지 이상이 쓰는 큰 덩어리(여러 feature와 entity를 엮은 블록)인가?** `widgets`다.

### 기본 원칙: 페이지에서 시작하고, 두 번째 사용처가 생기면 올린다

- 새 코드는 일단 `pages/<page>`에 둔다. 두 번째 페이지가 같은 코드를 쓰게 되는 순간 한 단계 아래 레이어(feature, widget, entity)로 옮긴다.
- 반대로 "나중에 쓸 것 같아서" 미리 feature나 widget을 만들지 않는다. 슬라이스가 많아질수록 import 규칙에 부딪힐 일만 늘어난다.
- 예외는 entities다. 일정, 재고, 장바구니, 사용자처럼 이름이 이미 도메인 명사인 것은 처음부터 entity로 만든다.

### 헷갈리는 경계

| 상황 | 판단 |
| --- | --- |
| entity와 feature 중 어디? | 데이터가 "무엇인가"(타입, 규칙, 보여 주는 모양)는 entity, 그 데이터로 "무엇을 하는가"(저장, 삭제, 전환)는 feature |
| 같은 도메인 컴포넌트 두 개가 서로 필요하다 | 같은 슬라이스 안에 두면 상대경로로 쓸 수 있다. 서로 다른 슬라이스에 있어서 막힌다면 슬라이스를 너무 잘게 나눈 것이다 |
| 한 feature가 다른 feature를 쓰고 싶다 | 막힌다. 두 feature를 조립하는 위젯이나 페이지에서 콜백이나 slot으로 연결한다 |
| 한 entity가 다른 entity의 타입이 필요하다 | `@x`로 필요한 타입만 내보낸다. 자주 그러면 두 entity를 하나로 합치는 것도 고려한다 |
| 규칙 함수(권한, 판정, 파생 값)를 어디에? | 그 데이터의 entity `lib`(서버에서도 쓰면 `api/server`). 화면 컴포넌트 안에 두지 않는다 |
| 상태 배지처럼 도메인 색과 문구가 있는 UI | entity의 `ui`. 도메인을 모르는 모양만 있으면 `shared/ui` |
| 폼 | 저장 행동이 있으면 feature, 입력 필드 모음만 있으면 해당 entity나 페이지의 `ui` |
| 한 파일이 import 방향을 어긴다 | 파일 위치를 고치기 전에 "이 코드가 정말 이 레이어의 책임인가"를 먼저 본다. 대개 한 레이어 아래로 내리거나 위로 올리면 풀린다 |

### 막혔을 때 점검

- 같은 레이어끼리 import해야 하는 상황이면 레이어가 잘못된 경우가 많다. 둘 중 하나를 한 층 올리거나(조립하는 쪽), 공통 부분을 한 층 내린다.
- 슬라이스 이름이 명사인지 동사인지 본다. feature가 명사로 되어 있거나 entity가 동사로 되어 있으면 레이어를 다시 고른다.
- 판단이 서지 않으면 `pages`에 두고 진행한다. 나중에 옮기는 비용이 잘못된 슬라이스를 만드는 비용보다 작다.

## 5. 슬라이스 시작 배치안

위 기준을 명세(CAL, INV, CART, BOT, ACC)에 적용한 시작점이다. 구현하면서 확정한다.

**처음부터 만든다**

| 레이어 | 슬라이스 | 이유 |
| --- | --- | --- |
| `shared` | `api`(Supabase 클라이언트, 요청 결과 래퍼), `ui`(Button, Dialog, EmptyState, Skeleton 등), `lib`(날짜, 포맷, `cn`), `config`(라우트 상수), `pwa` | 도메인을 모름 |
| `entities` | `user`, `family`, `event`, `inventory-item`, `inventory-meta`, `cart-item`, `chat-message` | 도메인 명사. `event`는 일정과 D-day, 일정 카테고리, 개인 일정 필터를 한 슬라이스에 모은다. `inventory-meta`(단위, 카테고리, 보관 장소)는 재고, 장바구니, 설정 세 곳이 쓰므로 별도 entity로 둔다 |
| `features` | `cart-checkout`, `chat-send` | 구매 완료는 두 entity를 엮고 규칙이 복잡하다. 챗봇 전송은 여러 화면의 채팅창이 쓴다 |
| `widgets` | `app-nav`, `chat-panel`, `calendar-view` | 모든 페이지가 쓰는 내비게이션, 모든 화면에서 열리는 채팅창, 홈과 일정 두 페이지가 쓰는 달력 |
| `pages` | `home`, `calendar`, `inventory`, `cart`, `settings`, `onboarding`, `invite` | 라우트 |

**페이지 안에서 시작하고, 두 번째 사용처가 생기면 승격한다**

| 코드 | 시작 위치 | 승격 신호 |
| --- | --- | --- |
| 일정 등록·수정 폼, 삭제 확인, 개인 전환 스위치 | `pages/calendar` | 홈이나 챗봇 화면에서 같은 폼이 필요해지면 `features/event-form` |
| 다가오는 일정, 축하 D-day 카드 | `pages/home` | 다른 페이지에도 노출하면 widget |
| 재고 +/- 조정, 다 썼어요 | `pages/inventory` | 홈 요약에서도 누르게 하면 feature |
| 홈 재고 요약, 장바구니 요약 | `pages/home` | 다른 페이지가 쓰면 widget |
| 장바구니 담기, 체크 | `pages/cart` | 재고 화면에서 담기를 쓰면 `features/cart-add` |
| 초대 링크 만들기, AI 키 등록, 푸시 설정, 홈 화면 설정, 탈퇴 | `pages/settings` | 다른 곳에서 재사용할 때 |
| 알림(`notification`) | 서버 코드와 `pages/settings` | 알림 목록 화면이 생기면 entity |

## 6. 슬라이스 사이 흐름 처리

FSD에서는 같은 레이어의 슬라이스끼리 import할 수 없다. 이 프로젝트에서 부딪히는 경우는 이렇게 푼다.

- **구매 완료 → 재고 반영(CART-07, CART-08, INV-12)**: `cart-checkout` 한 feature가 `cart-item`과 `inventory-item` 두 entity를 모두 import해서 처리한다. features가 entities를 import하는 것은 허용된다.
- **"다 썼어요" 뒤 장바구니에 담기(INV-04, CART-06)**: `inventory-mark-used-up`이 `cart-add`를 import할 수 없다. 이를 합치는 위젯이나 페이지가 두 feature를 조립하고, 담기 행동은 콜백이나 slot으로 넘긴다.
- **챗봇이 일정·재고·장바구니를 바꾸는 일(BOT-07, BOT-08)**: 클라이언트의 `chat-send`가 다른 feature를 부르지 않는다. 서버에서 챗봇 도구가 각 entity의 서버 함수를 호출하고, 결과는 응답과 Realtime 구독으로 화면에 반영된다.
- **여러 페이지가 쓰는 조합 블록**: 두 페이지 이상이 쓰면 위젯으로 올린다. 한 페이지만 쓰면 그 페이지 슬라이스 안에 둔다.

## 7. 경계 강제

- 경계는 `eslint-plugin-boundaries`로 강제한다. 버전은 고정하고, `dependencies` 규칙에 레이어 방향, 슬라이스 간 import 금지, `@x` 예외, public API(깊은 import 금지)를 넣는다.
- 새 프로젝트이므로 처음부터 `error`로 둔다.
- 설정을 넣은 뒤 규칙이 실제로 위반을 잡는지 일부러 어긴 코드(canary)로 한 번 확인한다.
- 검증 명령 실행은 `AGENTS.md`의 작업 규칙에 따라 사용자 승인 뒤에 한다.
