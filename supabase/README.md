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
