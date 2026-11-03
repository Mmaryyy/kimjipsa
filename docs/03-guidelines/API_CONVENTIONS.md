# API 규칙

상태: 서버 라우트 중심 구조는 **CONFIRMED**(기획서 §09). 요청·응답 형식, 오류 코드, 검증 방식은 **PROPOSED**이며 구현을 시작할 때 사용자와 확정한다. 확정되면 이 문서에서 `PROPOSED` 표시를 지운다.

## 1. 통신 경로 (CONFIRMED)

| 대상 | 경로 |
| --- | --- |
| 로그인, 실시간 구독 | 브라우저 → Supabase 직접 |
| AI 호출 | 인증된 맥미니 워커에서만 (ADR-0017) |
| 구글 캘린더, 푸시 발송 | 서버 라우트에서만 |
| 개인 일정이 섞이는 일정 조회, 챗봇 도구 | 서버 라우트가 요청자 권한으로 걸러서 응답 |
| 가정 범위 단순 CRUD(재고, 장바구니 등) | Supabase 직접 + RLS 가능 여부는 DEC-001에서 함께 정함 `PENDING` |

## 2. 계층 책임

- 라우트 핸들러(`app/api/**/route.ts`)는 요청 파싱, 인증 확인, 입력 검증, entity 서버 함수 호출, 응답 변환만 한다. 비즈니스 규칙을 넣지 않는다. (`FSD.md` §3)
- 서버 전용 함수는 슬라이스 `api/` 세그먼트의 `server-only` 파일에 둔다. 권한 규칙(개인 일정 필터 등)은 entity 서버 함수 한 곳에 둔다.
- 클라이언트 호출은 슬라이스 `api/api.ts`가 맡고, 컴포넌트는 `model`의 훅을 거친다 (`CODING_STANDARDS.md` §1).
- 요청·응답 타입은 슬라이스 `api/type.ts`에서 정의하고 서버·클라이언트가 같은 타입을 쓴다.

## 3. 요청·응답 형식 (PROPOSED)

- 경로는 자원 중심 REST 형태(`/api/events`, `/api/inventory-items/:id`, `/api/chat`). JSON.
- 성공/실패를 던지지 않고 결과 객체로 돌려준다.

```ts
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

- `code`는 클라이언트가 분기하는 기계용 값(`unauthorized`, `forbidden`, `validation_failed`, `not_found`, `ai_key_missing`, `ai_key_invalid`, `ai_quota_exceeded`, `invite_expired`, `invite_used`, `already_in_family` 등), `message`는 사용자에게 보일 수 있는 한국어.
- HTTP 상태: 200/201 성공, 400 검증 실패, 401 미인증, 403 권한 없음, 404 없음, 409 충돌(중복 등), 5xx 서버 오류. 상태와 `ok` 값이 어긋나지 않게 한다.
- 목록 응답이 상세 필드를 포함한다고 가정하지 않는다. (`CODING_STANDARDS.md` §4)

## 4. 인증·권한

- 모든 라우트는 세션에서 사용자와 가정을 확인한다. 클라이언트가 보낸 `family_id`, `user_id`를 신뢰하지 않는다.
- **개인 일정**: 요청자가 작성자가 아니면 `title`, `place`, `memo`를 응답에서 제거한다. 시간·카테고리 색·개인 표시는 남긴다 (CAL-04). 이 필터는 화면 조회와 챗봇 도구가 같은 함수를 쓴다 (BOT-10).
- **관리자 전용**: 집사 이름·기억 사용 설정, 초대 링크 발급. MVP에서는 모두 관리자지만 `member`/`child` 역할 구조가 있으므로 역할 검사를 코드에 둔다 (ACC-06).
- **대화·기억**: 본인 것만 조회·수정한다 (BOT-11).
- 초대 수락: 토큰 존재·미사용·미만료·수락자가 무소속인지 확인한다 (ACC-04, ACC-05).

## 5. 데이터 검증

- 서버 라우트에서 모든 입력을 검증한다(클라이언트 검증은 UX용). 검증 도구는 Zod다(ADR-0005).
- 검증 규칙의 출처는 요구사항이다. 예: 일정 제목 필수(CAL-01), 기간 일정의 종료일 > 시작일(CAL-02), 단위 삭제 시 사용 중 확인(INV-06), 알림 개수 3/5/10(CAL-13).
- 수량 `0`은 유효한 값이다.

## 6. 챗봇 API (PROPOSED)

- `POST /api/chat`: 메시지를 받아 가족 작업 큐에 등록한다. 맥미니 Hermes 모델을 자동 사용하며 앱 API 키를 요구하지 않는다 (BOT-05).
- 도구 호출은 서버 안에서 실행하며 호출 맥락을 구분한다: **직접 요청**이면 즉시 실행하고 결과를 응답에 포함, **자체 판단**이면 `pending_actions`를 만들고 확인 버튼 데이터를 응답한다 (BOT-07, BOT-08).
- `POST /api/chat/actions/:id/confirm|cancel`: 5분이 지난 요청은 `expired`로 거절하고 데이터를 바꾸지 않는다.
- AI 오류(키 오류, 한도 초과)는 오류 코드와 해결 위치 안내를 반환한다 (BOT-16).
- 기본 메시지와 FAQ(BOT-03, BOT-04)는 AI를 호출하지 않는다.

## 7. 비밀 정보

- 모델 인증은 Hermes가 관리한다. 앱 설정·워커 설정 응답에 제공자·모델·키를 포함하지 않는다 (ACC-08).
- 서비스 키, 암호화 마스터 키, VAPID 비공개 키는 서버 환경 변수로만 둔다. 환경 변수·시크릿을 추가하거나 바꾸는 작업은 끝내기 전에 검증할지 먼저 제안한다 (`AGENTS.md`).

## 2026-11-04 가족 집사 연동

가족 집사 API는 [연동 규약](../04-planning/mac-mini/kimjipsa-integration-contract.md)과 ADR-0017을 따른다. `/api/chat`·settings·memories·attachments·runs/:id/cancel 및 `/api/receipt-imports/:id/confirm|cancel`은 기존 쿠키·Origin 검사를 사용한다. `/api/agent/config`는 전용 워커 Bearer 인증, DB `agent_command`는 등록된 워커 JWT와 현재 작업 임대로 권한을 제한한다. `/api/cron/agent`는 기존 x-cron-secret으로 인증한다.
