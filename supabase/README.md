# P2 계정·가정 DB

원격 DB에는 적용하지 않았다. `migrations/20261016000000_accounts_and_families.sql`은
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
