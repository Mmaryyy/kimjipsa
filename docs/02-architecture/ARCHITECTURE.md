# 아키텍처

상태: 시스템 구성과 FSD 구조는 **CONFIRMED**(기획서 §09, `AGENTS.md`). 디렉터리 상세, 서버 함수 배치, 패턴은 **PROPOSED**로 표시한다. 폴더·슬라이스 이름은 프로젝트 초기 세팅 때 확정한다. 레이어·슬라이스·세그먼트 규칙과 배치 판단법은 [`FSD.md`](./FSD.md)가 기준이고, 이 문서는 중복하지 않고 시스템 관점만 다룬다.

## 1. 시스템 구성 (CONFIRMED)

```
브라우저 (PWA, Next.js)
  ├─ 로그인 · 실시간 구독 ─────────────► Supabase (Auth · Postgres/RLS · Realtime)
  └─ API 요청 ─► 서버 라우트 (Vercel)
                   ├─ 질문자 권한으로 조회 ──► Supabase
                   ├─ Supabase 작업 큐 ──────► 맥미니 Hermes
                   └─ M3 연동 ───────────────► Google Calendar (읽기+쓰기)
```

- 브라우저가 Supabase에 직접 닿는 것은 **로그인과 실시간 구독**뿐이다.
- 앱의 서버 라우트에서 인증·권한을 확인한 작업만 맥미니 워커가 처리한다. 모델 인증은 Hermes가 관리하며 브라우저에 전달하지 않는다(ADR-0017).
- 개인 정보 보호가 필요한 조회(일정)는 서버가 요청자 권한으로 걸러서 내려보낸다. 화면에서 가리는 것으로 끝내지 않는다.

## 2. 책임 분담

| 주체 | 하는 일 | 하지 않는 일 |
| --- | --- | --- |
| 브라우저 | 화면, 입력 검증(UX용), Realtime 구독, 서비스 워커(오프라인 읽기 전용, 푸시 수신) | AI·구글 호출, 암호화 키 접근, 권한 판정의 최종 결정 |
| 서버 라우트 | 권한 필터링, 챗봇 작업 등록, 푸시 발송, 입력 검증(최종) | 화면 렌더링 로직 |
| Supabase | 인증, 데이터 저장, RLS, 실시간 변경 알림 | 비즈니스 규칙의 단독 보유(규칙은 entity 서버 함수가 소유) |
| 스케줄러 `PENDING` | 아침 요약, 일정 시작 전 알림, 대화 요약 트리거, 90일 삭제 | 미정(DEC-004) |

## 3. 코드 구조 (FSD, CONFIRMED)

레이어는 `app` → `pages` → `widgets` → `features` → `entities` → `shared`이고 import는 위에서 아래로만 한다. 같은 레이어의 다른 슬라이스는 import하지 않는다(entity 간은 `@x`만). 경계는 린트로 강제한다.

**Next.js 연결**(FSD.md §3): 루트 `app/`에 얇은 라우트 파일, `src/pages`에 화면, `src/app`에 프로바이더·전역 스타일, 빈 루트 `pages/` 폴더로 Next의 Pages Router 오인 방지. 서버 전용 코드는 슬라이스 `api/`의 `server-only` 파일에 두고 라우트 핸들러(`app/api/**/route.ts`)는 호출만 한다.

## 4. 디렉터리 구조 (PROPOSED)

`FSD.md` §5의 시작 배치안을 요구사항에 맞춰 요약한다. 구현하면서 확정한다.

```
app/                         # Next 라우트 (얇게: src/pages 재수출) + app/api/**/route.ts
pages/                       # 빈 폴더 (README만)
src/
  app/                       # 프로바이더, 전역 스타일, PWA 등록, 앱 셸
  pages/                     # home, calendar, inventory, cart, chat, settings, onboarding, invite
  widgets/                   # app-nav, calendar-view
  features/                  # cart-checkout, chat-send   (그 외는 페이지에서 시작해 승격)
  entities/                  # user, family, event, inventory-item, inventory-meta, cart-item, chat-message
  shared/                    # api(Supabase 클라이언트, 요청 결과 래퍼), ui, lib, config, pwa
```

## 5. 도메인별 모듈 책임 (PROPOSED)

| 영역 | 주 모듈 | 책임 |
| --- | --- | --- |
| 일정(CAL) | `entities/event`, `pages/calendar`, `widgets/calendar-view` | 일정 타입, D-day 계산, **개인 일정 필터(서버 함수 한 곳)**, 카테고리, 달력 뷰 |
| 재고(INV) | `entities/inventory-item`, `entities/inventory-meta`, `pages/inventory` | 부족·없음·임박 판정, 단위·카테고리·보관 장소, 수량 조정 |
| 장바구니(CART) | `entities/cart-item`, `features/cart-checkout`, `pages/cart` | 실시간 목록, 체크, 구매 완료 → 재고 반영(두 entity를 엮음) |
| 챗봇(BOT) | `entities/chat-message`, `features/chat-send`, `pages/chat`, `app/ui/chat-launcher`, 서버 도구 | 전용 대화 화면과 진입 버튼, 기본 메시지/FAQ, 도구 호출, 확인 대기 액션, 기억 |
| 가정·계정(ACC) | `entities/user`, `entities/family`, `pages/settings`, `pages/onboarding`, `pages/invite` | 로그인, 가정, 초대, 집사 설정 |

## 6. 핵심 설계 규칙

1. **권한 규칙은 한 곳.** 개인 일정 필터(CAL-04, BOT-10)는 `entities/event`의 서버 함수 하나다. 화면용 조회와 챗봇 도구가 같은 함수를 호출한다. (FSD.md §3)
2. **챗봇은 서버에서 다른 entity를 호출한다.** 클라이언트의 `chat-send`가 다른 feature를 부르지 않는다. 결과는 응답과 Realtime으로 화면에 반영된다. (FSD.md §6)
3. **직접 요청은 즉시 실행, 챗봇 판단은 `pending_action`.** 챗봇 도구는 호출 맥락(직접 요청 / 자체 판단)을 구분해 실행 경로를 나눈다. 확인 대기는 5분 뒤 만료되며 만료돼도 데이터는 바뀌지 않는다. (BOT-07, BOT-08)
4. **파생 값은 저장하지 않는다.** 부족/없음/임박/D-day 남은 일수는 계산한다. (`CODING_STANDARDS.md` §5)
5. **AI는 어댑터 한 겹.** 제공자 차이(도구 호출 형식, OCR)는 어댑터 안에서 흡수하고, 챗봇 도메인 코드는 제공자를 모른다. 가정당 제공자는 하나다.
6. **AI는 맥미니에서 자동 연결.** 앱에서 모델 키를 요구하지 않는다. 워커 오프라인이면 작업 대기를 안내하고 FAQ는 계속 동작한다. (BOT-05)
7. **슬라이스 간 흐름은 상위에서 조립한다.** 구매 완료 → 재고 반영은 `cart-checkout` 한 feature가 두 entity를 import해 처리한다. (FSD.md §6)

## 7. 데이터 흐름 예시 (PROPOSED)

- **일정 조회**: 브라우저 → 서버 라우트 → `event` 서버 함수(요청자 id로 개인 일정 마스킹) → 응답. 실시간 갱신에서 개인 일정 컬럼이 유출되지 않는 구조가 필요하다 → DEC-001.
- **장바구니 공동 편집**: 브라우저 ↔ Supabase 직접(RLS로 가정 범위 제한) + Realtime 구독으로 상대 화면 반영. 끊기면 마지막 목록을 읽기 전용 표시.
- **챗봇 요청**: 채팅 입력 → 서버 라우트 → 가정의 AI 어댑터 → 모델이 도구 호출 요청 → 서버가 요청자 권한으로 entity 서버 함수 실행 → 결과를 모델에 전달 → 응답. 자체 판단 변경은 `pending_action`으로 저장 후 확인 버튼.
- **구매 완료**: 체크 항목 → 재고 반영 확인 화면(수량·보관 장소·유통기한 수정) → 반영 시 같은 품목은 수량 가산, 없으면 새 품목 → 장바구니 항목에 `purchased_at` 기록.

## 8. 에러 처리 방향 (PROPOSED)

- API 호출은 던지지 않고 `{ ok: true, data } | { ok: false, error }`를 돌려주는 공용 래퍼를 쓴다 (`CODING_STANDARDS.md` §1, 채택 시 공용 함수 하나). 상세는 `API_CONVENTIONS.md`.
- AI 오류(키 오류, 한도 초과)는 원인과 해결 위치를 사용자에게 안내한다. (BOT-16, ACC-09)
- 화면 상태는 Loading / Empty / Error를 모두 둔다. (`DESIGN_SYSTEM.md`)

## 9. 신규 기능을 추가하는 기준

1. 요구사항 ID를 확인하고 `REQUIREMENTS.md`, 해당 명세 원문을 읽는다.
2. 코드 위치는 `FSD.md` §4의 질문 순서로 정한다. 모르면 `pages`에서 시작한다.
3. 권한이 걸린 조회는 서버 함수로 만들고 화면과 챗봇이 함께 쓰게 한다.
4. 새 데이터 항목은 `DATA_MODEL.md`를 먼저 확인한다. 명세에 없는 필드는 추가하지 말고 `DECISIONS_REQUIRED.md`에 올린다.
5. 기술·구조 변경이 있으면 ADR을 작성한다.

## 2026-11-04 가족 집사 연동

가족 집사 실행 구조는 [ADR-0017](ADR/0017-local-family-agent.md)을 따른다. 앱 → Vercel → Supabase 영속 작업 → `ai-gateway/` 맥미니 워커 → 로컬 Hermes → 작업 권한 RPC 순서다. 앱은 제공자·모델·키를 다루지 않으며 맥미니의 `kimjipsa` 프로필에 설정된 모델과 Hermes 공용 인증을 사용한다. 모델이 없는 최초 설정만 기본 프로필에서 가져오며 이후에는 프로필별 선택을 보존한다. 임시 개인 프로필도 김집사 모델을 사용한다.


일정·장보기 확장에서는 워커가 `/api/agent/context`로 작업 요청자의 문맥을 받고 `/api/agent/complete`로 구조화된 결과를 제출한다. 앱 라우트는 기존 entity 검증과 일정 공개 범위·반복 전개 함수를 재사용한다. RPC는 워커·임대·가정·원래 요청자·조회 시점의 리비전을 다시 검사한 뒤 기존 쓰기 함수를 실행한다. ‘나만 보기’의 대화와 개인 일정은 작성자에게만 제공한다. 자체 판단 변경은 `/api/chat/actions/[id]` 확인으로 실행한다.

웹 검색은 맥미니의 별도 프로세스가 설치된 Hermes 검색 백엔드를 호출한다. 입력은 현재 요청에 실제 포함된 검색어 하나이고 결과는 출처 URL·제목·검색 요약이다. 검색 답변 모델에는 현재 질문과 검색 결과만 공급하며 변경 작업은 허용하지 않는다.

[ADR-0018](ADR/0018-hermes-memory-and-household-skill.md)에 따라 공용 `kimjipsa` 프로필의 Hermes 자체 기억을 활성화하고 Supabase 기억과 별도로 관리한다. `kimjipsa-supabase` 스킬 → 로컬 인증 도구 → `/api/agent/read` → `agent_read` RPC로 가정 공용 정보를 조회한다. ‘나만 보기’·사진·검색은 기억이 꺼진 임시 프로필에서 처리한다.

### 앱 개인 대화와 보존 (2026-11-04 사용자 변경)

BOT-11/14: 앱은 개인 대화만 제공한다. 마지막 메시지 후 1시간이 지나면 조회·요청 및 5분 정리 작업에서 해당 사용자의 메시지·작업·확인 자료를 삭제한다. 만료와 워커 완료는 기존 가정 잠금으로 직렬화한다. `chat_page`는 만료 처리를 포함하는 쓰기 가능한 RPC이며, 대화 버전으로 브라우저의 이전 페이지와 새 대화를 분리한다. 가족 기억과 Hermes 기억은 별도 보존한다.
