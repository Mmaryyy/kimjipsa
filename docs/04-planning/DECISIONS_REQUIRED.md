# Decisions Required

사용자 결정이 필요한 사항이다. 결정되면 Status를 바꾸고, 기술·구조 결정은 `docs/02-architecture/ADR/`에 기록한 뒤 관련 문서(`TECH_STACK.md` 등)를 갱신한다. 결정 전에는 추측해서 구현하지 않는다. 우선순위는 아키텍처 영향, 변경 비용, 외부 비용, 보안·개인정보, 명세 불명확, 주요 스택 순이다.

| ID | 주제 | 우선 | 막는 것 | Status |
| --- | --- | --- | --- | --- |
| DEC-001 | 개인 일정 컬럼 보호 구조 | 높음 | 일정 스키마, Realtime, 첫 마이그레이션 | PENDING |
| DEC-002 | 언어·UI·날짜 스택 | 높음 | 프로젝트 초기화 | PENDING |
| DEC-003 | AI 키 암호화 방식 | 높음 | ACC-08, 챗봇 | PENDING |
| DEC-004 | 예약 작업(알림·요약·삭제) 실행 방식 | 높음 | CAL-09~11, BOT-12, BOT-14 | PENDING |
| DEC-005 | 동일 이메일 로그인 수단 분리 | 중간 | ACC-01 | PENDING |
| DEC-006 | 서버 상태·폼·검증 라이브러리 | 중간 | 데이터 계층 구현 | PENDING |
| DEC-007 | 테스트 도구 | 중간 | 테스트 작성 | PENDING |
| DEC-008 | 알림 요구사항의 마일스톤 배치 | 중간 | ROADMAP, M1 범위 | PENDING |
| DEC-009 | 데이터 모델 공백 | 중간 | 스키마 확정 | PENDING |
| DEC-010 | 판정 기준 모호 항목 | 낮음 | INV-16, CART-05, CART-12 | PENDING |
| DEC-011 | 영수증 이미지 저장 | 낮음(M3) | INV-17 | PENDING |
| DEC-012 | AI 어댑터 구현 방식 | 낮음(M2) | 챗봇 | PENDING |
| DEC-013 | 도메인·약관·모니터링·백업 | 중간 | 로그인 심사, 베타 | PENDING |

---

## DEC-001
### Topic
개인 일정의 제목·장소·메모를 배우자에게 보내지 않으면서 시간 칸은 보이게 하는 DB·실시간 구조.
### Background
CAL-04: 배우자의 개인 일정은 희미한 칸만 보이고 제목·장소·메모는 "브라우저에 전달되지 않아야" 한다(명세 프라이버시 규칙). 그런데 RLS는 행 단위 접근 제어라 한 행의 일부 컬럼만 숨기지 못한다. 기획서 §09는 브라우저가 Supabase에 직접 연결하는 것을 로그인·실시간 구독으로 한정하므로, 일정 Realtime을 쓰면 개인 일정 페이로드가 유출될 수 있다.
### Options
A. 시간 정보 테이블(`events`)과 내용 테이블(`event_details`: title/place/memo)을 분리하고, 내용 테이블 RLS를 "공유이거나 작성자"로 제한. 일정 조회·구독은 시간 테이블만 직접.
B. 일정은 서버 라우트로만 조회하고 Realtime은 쓰지 않음(변경 시 폴링/푸시로 갱신). 장바구니만 Realtime.
C. 마스킹용 뷰(security_invoker)로 컬럼을 가리고 뷰를 조회. Realtime 구독 가능 여부와 RLS 동작을 검증해야 함.
### Recommendation
A. 행 분리는 DB 수준에서 유출을 막고, 챗봇·화면이 같은 서버 함수를 쓰는 규칙과도 잘 맞는다. 선택 후 canary 테스트(배우자 세션으로 직접 조회·구독)로 검증한다.
### Impact
일정 스키마와 `entities/event` 서버 함수 구조, 개인 일정 전환(CAL-03) 구현 방식, 첫 마이그레이션이 달라진다. 보안·개인정보 항목이라 승인 필수.
### Status
PENDING

## DEC-002
### Topic
언어·스타일링·UI·날짜 라이브러리 확정 (TypeScript strict, Tailwind + CVA, shadcn/ui, date-fns, 타임존 기준).
### Background
`CODING_STANDARDS.md`가 TypeScript, Tailwind/CVA, shadcn을 전제로 한 규칙을 조건부로 담고 있고 `package.json`이 아직 없다. 날짜 기능이 많고(D-day, 월·주·일 뷰, 아침 요약) 타임존 기준이 명세에 없다.
### Options
TypeScript + Tailwind + CVA + shadcn/ui + date-fns(KST 고정) / 다른 조합 / 타임존을 사용자별로 저장.
### Recommendation
제안 스택 그대로, 타임존은 MVP에서 `Asia/Seoul` 고정(1차 사용자가 국내 부부)으로 시작하고 확장 여지를 남긴다.
### Impact
프로젝트 초기화, 코딩 표준의 조건부 규칙 확정, 디자인 토큰 파일 위치.
### Status
PENDING

## DEC-003
### Topic
AI 키를 서버에서 암호화해 저장하는 방식.
### Background
ACC-08은 "서버에서 암호화 저장, 화면엔 끝자리만"만 규정한다. 방식과 마스터 키 관리가 없다. 이 키는 가정의 외부 서비스 비용과 직결된다.
### Options
A. 앱 레벨 AES-GCM, 마스터 키를 Vercel 환경 변수에 보관.
B. Supabase Vault(pgsodium) 사용.
C. 외부 KMS.
### Recommendation
MVP는 A 또는 B 중 단순한 쪽. 키 교체 절차(마스터 키 회전 시 재암호화)와 로그 마스킹 규칙을 함께 정한다. 사용자 승인 전 구현하지 않는다.
### Impact
ACC-08/09, 챗봇 서버 코드, 환경 변수·시크릿 구성(변경 시 검증 제안 필요).
### Status
PENDING

## DEC-004
### Topic
예약 작업을 어디서 어떻게 실행할지.
### Background
필요한 작업: 사용자별 시각의 아침 요약(CAL-10), 일정별 시작 N분 전 알림(CAL-11), 5분 무활동 후 대화 요약(BOT-12), 90일 지난 대화 삭제(BOT-14), 선제 제안(BOT-17, M3), 푸시 발송. 서버리스에서는 타이머가 없고, Vercel 무료 플랜의 Cron은 실행 빈도 제한이 있어 분 단위 알림이 어려울 수 있다(플랜 한도 확인 필요).
### Options
A. Supabase `pg_cron`(1분 주기) + 서버 라우트 호출 또는 Edge Function.
B. Vercel Cron(플랜 제약 확인) + 서버 라우트.
C. 외부 스케줄러 서비스.
### Recommendation
A가 후보. 확정 전에 실제 플랜 한도를 확인하고, 대화 요약은 "다음 대화 시작 시 이전 대화가 5분 이상 비었으면 요약" 같은 지연 처리를 허용할지도 함께 정한다.
### Impact
알림 요구사항 전체, DB 스키마(푸시 구독, 발송 기록), 비용.
### Status
PENDING

## DEC-005
### Topic
같은 이메일의 카카오·구글 로그인을 별개 계정으로 유지하는 방법.
### Background
명세 확정 정책: 수단별 별개 계정, 합치기 없음. Supabase Auth는 기본적으로 같은 이메일 아이덴티티를 연결하는 동작이 있어 설정/우회 방식이 필요할 수 있다. 카카오는 이메일 제공 여부가 설정에 따라 다르다.
### Options
Supabase Auth의 자동 연결 설정 조정 / 이메일 대신 제공자 id로 구분 / 계정 연결을 허용(명세 변경).
### Recommendation
구현 전에 Supabase 동작을 확인한 뒤 명세와 맞는 방식을 고른다. 명세와 다르게 동작하면 사용자에게 보고하고 문서를 먼저 고친다.
### Impact
ACC-01, 보안(계정 탈취 가능성), 온보딩 흐름.
### Status
PENDING

## DEC-006
### Topic
서버 상태, 폼, 검증, 전역 UI 상태 라이브러리.
### Background
`STATE_MANAGEMENT.md`는 라이브러리 확정 전이다.
### Options
TanStack Query + React Hook Form + Zod + 필요 시 Zustand / SWR 등 / 직접 훅.
### Recommendation
TanStack Query + Zod 우선 채택. 폼 라이브러리는 폼이 많은 일정·재고·설정 구현을 시작할 때 재검토.
### Impact
데이터 계층 구조, 코딩 표준 갱신.
### Status
PENDING

## DEC-007
### Topic
테스트 도구와 CI 여부.
### Background
`TESTING.md`는 도구 독립적으로 작성했다.
### Options
Vitest + Testing Library + Playwright / Jest 계열.
### Recommendation
제안 스택. CI 구성은 배포 설정이므로 별도 승인.
### Impact
테스트 작성 스킬(`write-tests`), 스크립트.
### Status
PENDING

## DEC-008
### Topic
알림 요구사항(CAL-09~11, ACC-11)의 마일스톤.
### Background
명세는 CAL-09~11을 `MVP`로 표기하지만, 기획서 §08은 "반복 일정·알림"을 M3에 둔다. M1에는 "웹 푸시" 기반(PWA)만 있다.
### Options
알림을 M1~M2로 당김 / 기획서대로 M3 / 앱 내 알림은 MVP, 푸시와 예약은 M3.
### Recommendation
의존성(DEC-004)을 고려해 앱 내 알림과 배우자 변경 알림(CAL-09)을 M1에, 아침 요약·일정별 알림을 M2~M3에 두는 방안. 사용자가 정하면 기획서·명세를 먼저 맞춘다.
### Impact
ROADMAP, M1 범위.
### Status
PENDING

## DEC-009
### Topic
명세 데이터 항목에 없는 필드와 처리.
### Background
다음은 요구사항에 있으나 데이터 항목에 없다: ① 푸시 구독 정보와 앱 내 알림 저장, ② 축하 D-day 문구와 카드 닫음 상태(사용자·연도별), ③ 장바구니 카테고리(마트 코너) 순서의 저장 단위, ④ 탈퇴자가 만든 공유 일정/항목의 작성자 표시, ⑤ 초대의 생성자·수락자, ⑥ 카테고리 삭제 시 소속 일정·품목, ⑦ 기본 목록 시드 방식.
### Options
항목별로 최소 필드를 추가(제안) / 명세를 먼저 보강.
### Recommendation
항목별 제안을 모아 명세에 반영한 뒤 스키마를 정한다.
### Impact
`DATA_MODEL.md`, 마이그레이션.
### Status
PENDING

## DEC-010
### Topic
판정 기준이 모호한 요구사항.
### Background
INV-16 "비슷한 이름", CART-12 "같은 이름" 판정(공백·대소문자·부분 일치?), CART-05 "최근 구매가 많은 순"의 기간. `CODING_STANDARDS.md` §5는 동일성 규칙을 한 곳에서 관리하라고만 한다.
### Options
정규화 후 완전 일치(공백·대소문자 무시) 우선, 유사 판정은 부분 포함 정도 / 최근 N일 지정.
### Recommendation
MVP는 정규화 후 완전 일치 + 포함 관계, 최근 구매는 최근 90일(예시, 사용자 확정 필요).
### Impact
재고·장바구니 등록 흐름.
### Status
PENDING

## DEC-011
### Topic
영수증 사진의 저장 여부와 위치(M3).
### Background
INV-17은 사진을 올려 AI가 품목을 추출한다. 이미지를 보관할지, 처리 후 폐기할지, 어느 AI에 보내는지 명시가 없다. 개인정보와 비용 관련.
### Options
처리 후 즉시 폐기 / Supabase Storage에 보관(기간 정책 필요).
### Recommendation
폐기(저장 안 함). 필요해지면 보관 정책을 추가.
### Impact
파일 저장소 필요 여부, 개인정보 처리방침.
### Status
PENDING

## DEC-012
### Topic
AI 어댑터를 직접 구현할지 라이브러리를 쓸지.
### Background
Claude, Gemini 두 곳만 지원하고 도구 호출 형식이 다르다. 출시 전에 제공자별 점검이 필요하다.
### Options
공식 SDK/REST를 감싼 직접 어댑터 / 통합 라이브러리 사용.
### Recommendation
직접 얇은 어댑터. 단, 라이브러리 도입이 도구 호출 차이를 확실히 줄이면 재검토.
### Impact
`entities/chat-message` 서버 코드, 의존성.
### Status
PENDING

## DEC-013
### Topic
자체 도메인, 이용약관·개인정보처리방침, 에러 모니터링, DB 백업.
### Background
기획서 §11이 필요하다고 했으나 시기·도구·비용이 없다. 구글 로그인·캘린더 승인에는 소유 확인 가능한 도메인이 필요하다.
### Options
도메인 구입 시기(M1 로그인 심사 전 vs M3 전), 약관 작성 방식, 모니터링 도구, 백업 방식.
### Recommendation
로그인 심사 일정에 맞춰 도메인을 먼저 정하고, 약관은 최소안으로 베타 전에.
### Impact
외부 비용, 로그인 심사, 출시 일정. 비용이 발생하므로 승인 필수.
### Status
PENDING
