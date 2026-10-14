# 아키텍처

상태: 시스템 구성과 FSD 구조는 **CONFIRMED**(기획서 §09, `AGENTS.md`). 디렉터리 상세, 서버 함수 배치, 패턴은 **PROPOSED**로 표시한다. 폴더·슬라이스 이름은 프로젝트 초기 세팅 때 확정한다. 레이어·슬라이스·세그먼트 규칙과 배치 판단법은 [`FSD.md`](./FSD.md)가 기준이고, 이 문서는 중복하지 않고 시스템 관점만 다룬다.

## 1. 시스템 구성 (CONFIRMED)

```
브라우저 (PWA, Next.js)
  ├─ 로그인 · 실시간 구독 ─────────────► Supabase (Auth · Postgres/RLS · Realtime)
  └─ API 요청 ─► 서버 라우트 (Vercel)
                   ├─ 질문자 권한으로 조회 ──► Supabase
                   ├─ AI 호출 (어댑터) ──────► Claude / Gemini (BYOK)
                   └─ M3 연동 ───────────────► Google Calendar (읽기+쓰기)
```

- 브라우저가 Supabase에 직접 닿는 것은 **로그인과 실시간 구독**뿐이다.
- AI와 구글 캘린더는 **서버 라우트에서만** 호출한다. 키가 브라우저에 나가지 않고, 챗봇도 질문자 권한으로 데이터를 거르기 위해서다.
- 개인 정보 보호가 필요한 조회(일정)는 서버가 요청자 권한으로 걸러서 내려보낸다. 화면에서 가리는 것으로 끝내지 않는다.

## 2. 책임 분담

| 주체 | 하는 일 | 하지 않는 일 |
| --- | --- | --- |
| 브라우저 | 화면, 입력 검증(UX용), Realtime 구독, 서비스 워커(오프라인 읽기 전용, 푸시 수신) | AI·구글 호출, 암호화 키 접근, 권한 판정의 최종 결정 |
| 서버 라우트 | 권한 필터링, 챗봇 도구 실행, AI 어댑터 호출, 키 복호화, 푸시 발송, 입력 검증(최종) | 화면 렌더링 로직 |
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
  pages/                     # home, calendar, inventory, cart, settings, onboarding, invite
  widgets/                   # app-nav, chat-panel, calendar-view
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
| 챗봇(BOT) | `entities/chat-message`, `features/chat-send`, `widgets/chat-panel`, 서버 도구 | 대화, 기본 메시지/FAQ, 도구 호출, 확인 대기 액션, 기억 |
| 가정·계정(ACC) | `entities/user`, `entities/family`, `pages/settings`, `pages/onboarding`, `pages/invite` | 로그인, 가정, 초대, 설정, AI 키 |

## 6. 핵심 설계 규칙

1. **권한 규칙은 한 곳.** 개인 일정 필터(CAL-04, BOT-10)는 `entities/event`의 서버 함수 하나다. 화면용 조회와 챗봇 도구가 같은 함수를 호출한다. (FSD.md §3)
2. **챗봇은 서버에서 다른 entity를 호출한다.** 클라이언트의 `chat-send`가 다른 feature를 부르지 않는다. 결과는 응답과 Realtime으로 화면에 반영된다. (FSD.md §6)
3. **직접 요청은 즉시 실행, 챗봇 판단은 `pending_action`.** 챗봇 도구는 호출 맥락(직접 요청 / 자체 판단)을 구분해 실행 경로를 나눈다. 확인 대기는 5분 뒤 만료되며 만료돼도 데이터는 바뀌지 않는다. (BOT-07, BOT-08)
4. **파생 값은 저장하지 않는다.** 부족/없음/임박/D-day 남은 일수는 계산한다. (`CODING_STANDARDS.md` §5)
5. **AI는 어댑터 한 겹.** 제공자 차이(도구 호출 형식, OCR)는 어댑터 안에서 흡수하고, 챗봇 도메인 코드는 제공자를 모른다. 가정당 제공자는 하나다.
6. **AI 키 없음은 정상 상태.** 키가 없으면 AI 경로만 막고 기본 메시지/FAQ는 AI 없이 동작한다. (BOT-05)
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
