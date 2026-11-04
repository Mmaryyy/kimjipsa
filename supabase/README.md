# Supabase 데이터베이스

## 원격 연결·적용 이력 (2026-11-04)

로컬 `.env.local`의 `SUPABASE_DB_URL`로 원격 DB에 직접 연결한다. Supabase
**Connect → Method: Session pooler → URI**의 포트 **5432** 주소를 사용한다.
이 맥의 네트워크에서는 IPv6 전용 Direct connection 주소에 연결할 수 없었다.
비밀번호는 URL 인코딩하고, 연결 문자열을 채팅·로그·명령행 인자에 출력하지 않는다.
앱·워커 실행에는 이 변수가 필요하지 않아 실행 복사본으로 옮기지 않는다.

TLS는 인증서와 호스트 이름을 검증한다. Node PostgreSQL 클라이언트에서는
`ssl.ca`에 [Supabase 공개 루트 인증서](certs/prod-ca-2021.crt)를 읽어 넣고
`rejectUnauthorized: true`를 사용한다. URI의 `sslmode` 등 SSL 옵션이 별도로
전달한 `ssl` 설정을 덮어쓰지 않도록 연결 설정을 구성한다. 인증서 검증을 끄지 않는다.
인증서는 [Supabase 공식 배포 주소](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)에서
받았으며 2031-04-26까지 유효하다. DB 비밀번호와 달리 공개 인증서다.

앱의 Supabase 프로젝트와 DB 연결 대상이 같은지 확인한 뒤 다음을 수행했다.

- 기존 17개 마이그레이션의 테이블·열·제약·인덱스·함수·트리거·RLS 정책을
  로컬 재구성 결과와 대조했다. 아래의 기존 차이는 보존했다.
- `chat_page(jsonb)`와 페이지 조회 인덱스 3개가 원격 DB에 없는 것을 확인하여
  `20261104030000_chat_pagination.sql`을 직접 적용했다.
- Supabase CLI와 같은 `supabase_migrations.schema_migrations` 구조로 적용 이력
  18개를 등록했다. 기존 17개 SQL은 다시 실행하지 않았다. 기존 이력의
  `statements`는 실제 과거 실행문을 확정할 수 없어 NULL로 두었다.

이후에는 적용 이력과 로컬 파일을 비교하여 새 마이그레이션만 적용하고, 성공한
버전을 기록한다. 이미 적용된 파일을 수정하거나 전체 SQL을 재실행하지 않는다.
연결 성공만으로 DB 변경을 자동 실행하지 않으며, 요청된 변경 범위에서 적용한다.

같은 날 `20261104040000_hermes_shared_read.sql`을 추가 적용하여 현재 이력은 19개다.
Hermes 조회 스킬이 활성 워커의 가정 정보를 읽는 RPC이며 개인 일정 내용·쓰기 권한은
제공하지 않는다. 기존 데이터는 변경하지 않았다.

### 기존 원격 DB와 로컬 초기 스키마의 차이

- 원격 `users.terms_accepted_at`, `privacy_accepted_at`, `terms_version`은 NULL을
  허용한다. `20261030010000_beta_consent.sql`의 기존 계정 보존 방침에 따른다.
  동의 이력을 임의로 채우지 않았다.
- 원격의 가정 이름·표시 이름 CHECK 제약은 비어 있지 않은지만 검사한다.
  로컬 초기 스키마의 가정 이름 10자·표시 이름 6자 상한과 다르며, 원격
  `create_family`에도 10자 검사가 없다. `complete_profile`의 6자 검사는 있다.
  이 기존 차이는 이번 연결·이력 정리에서 수정하지 않았다. 이후 수정 시 별도
  마이그레이션과 기존 데이터 확인이 필요하다.

## P2 계정·가정 DB — 최초 작성 당시 기록

P2 작성 당시에는 원격 DB에 적용하지 않았다. `migrations/20261016000000_accounts_and_families.sql`은
ACC-01~07의 사용자, 가정, 구성원, 초대와 RLS·RPC를 담는다.

승인 후 Supabase CLI와 Docker가 있는 로컬 환경에서 `supabase start`,
`supabase db reset --local`로 적용한다. 생성 타입은 이후 아래 명령으로 교체한다.
현재 `src/shared/api/database.types.ts`는 마이그레이션에 맞춘 수기 타입 계약이며,
DB에서 생성·대조한 타입은 아니다.

```sh
supabase gen types typescript --local > /tmp/kimjipsa-database.types.ts
# 명령이 성공한 뒤 src/shared/api/database.types.ts로 옮긴다.
```

앱은 공개 anon 키와 요청자의 세션만 사용한다. 서비스 역할 키는 필요하지 않다.
쓰기 권한은 일반 테이블에 주지 않고, `complete_profile`, `create_family`,
`create_invite`, `accept_invite` RPC에만 준다. 약관·개인정보 동의를 모두
확인한 뒤에만 프로필을 만든다. 승인된 모델에 없는 동의 이력·버전 필드는
추가하지 않는다. 이메일은 프로필에 저장하지 않는다.

초대 수락은 사용자별 트랜잭션 잠금, 초대 행 잠금, 사용자당 하나의 구성원
제약을 함께 사용한다. 초대 토큰은 임의 UUID이며 미인증 미리보기는 토큰을
가진 사람에게 상태와 유효한 초대의 가정 이름만 반환한다. 사용·만료 여부는
DB 시계로 판정한다. 사용 상태를 먼저 표시한다.

Supabase 대시보드에는 localhost와 사용하는 Vercel 기본 도메인의
`/auth/callback`을 Redirect URL로 등록한다. 구글은 테스트 모드와 테스트
사용자로 설정한다. 카카오는 이메일 동의 항목을 끄고 Supabase 카카오 설정의
`Allow users without an email`을 켠다. 앱은 연결된 identity가 여러 개이거나
카카오 계정에 이메일이 있으면 계정 분리 정책 오류로 중단한다.

실제 카카오 이메일 미수집 로그인과 같은 이메일의 구글 별개 계정 여부는
아직 시험하지 않았다(ADR-0009). 실제 로그인 시험은 계정 생성이 일어날 수
있으므로 이번 작업에서 실행하지 않았다.

P3의 첫 일정 카테고리는 `families.name`에서 생성해야 한다. P2에는 일정
스키마·기본 시드를 만들지 않는다. SCN-ACC-6 탈퇴는 P10에 해당하므로 P2에서
구현·실행하지 않는다. P2 확인 대상은 SCN-ACC-1의 카테고리 부분을 제외한
온보딩, SCN-ACC-2~3, SCN-ACC-7이다.

## P3 일정

`20261016010000_events.sql`은 ADR-0012의 시간/내용 분리, RLS, 원자적
일정·카테고리 RPC와 기본 카테고리 시드를 추가한다. 기존 가정에도 시드하며,
새 가정은 `create_family` 트랜잭션의 트리거로 채운다. 이름이 기본 카테고리와
같은 가정은 중복 이름을 만들지 않는다. `기타`는 삭제·이름 변경을 막고,
삭제된 카테고리의 개인/공유 일정은 모두 기타로 옮긴다.

시작일·종료일은 서울 기준 날짜로 저장하며 종료일을 포함한다. 시작·종료 시각은
각각 선택이고, 둘 다 비우면 종일과 별개인 시간 미정이다. 같은 날 두 시각이
있으면 종료가 시작보다 뒤여야 한다. 종일이면 두 시각을 비운다.
작성자는 수정 시 유지하며 공유→개인 전환은 작성자만 할 수 있다.
카테고리 기본 순서는 가정 이름이 0번째, 나머지는 이름순이며 `sort_order`로 바꾼다.
내용 테이블은 Realtime publication에 넣지 않는다. 시간 테이블만 발행하여
내용 전용 변경도 같은 트랜잭션의 시간 행 UPDATE로 화면을 갱신한다.
알림·D-day·반복·외부 연동 필드는 해당 Phase에서 추가한다.

로컬 마이그레이션 적용 후 `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`,
`SUPABASE_TEST_SERVICE_ROLE_KEY`에 **로컬 인스턴스** 값을 설정하면 아래
canary를 실행할 수 있다. 이 테스트는 HTTP loopback 주소만 허용한다.
작성자·배우자·다른 가정의 일회용 사용자를 만들고 종료 시 해당 fixture만 지운다.
환경 변수 값은 저장소에 기록하지 않는다. URL이 없으면 DB 테스트는 skip되므로
단위/UI 테스트 통과를 실제 RLS·Realtime 검증 통과로 해석하면 안 된다.

```sh
yarn test src/app/api/event-security.integration.test.ts
```

테스트에는 직접 조회, 중첩 조회, 공용 서버 함수 응답, 개인 일정 변경 거절,
다른 가정 격리, 공유/개인 전환, Realtime의 INSERT/UPDATE/DELETE,
카테고리 삭제 시 재배정이 포함된다. 실행은 사용자 승인 후에만 한다.
