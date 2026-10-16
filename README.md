# 김집사 (kimjipsa)

신혼부부가 일정, 재고, 장바구니를 같이 관리하고 AI 집사 챗봇이 조회·실행·제안까지 해 주는 가정 관리 서비스. 모바일 우선 PWA(Next.js, Supabase, Vercel).

P2 로그인·약관·가정·초대 화면과 로컬 마이그레이션을 작성했다. 원격 DB 적용과 실제 OAuth·RLS 검증은 아직 하지 않았다.

Node.js 22.12 이상과 Corepack을 사용한다.

```sh
corepack enable
yarn install --immutable
yarn dev
```

전역 Corepack shim을 설치할 수 없는 환경에서는 `corepack yarn`으로
`yarn` 명령을 대신 실행할 수 있다.

파일 감시가 제한된 환경에서는
`WATCHPACK_POLLING=true yarn dev --webpack`으로 실행한다.

- `yarn lint`, `yarn typecheck`, `yarn build`: 정적 검사와 프로덕션 빌드
- `yarn format <파일...>`, `yarn format:check <파일...>`: 이번 작업 파일만 포매팅·확인
- `yarn format`, `yarn format:check`: 인자가 없으면 바뀐·새 파일만 포매팅·확인
- `yarn format:check --all`: 저장소 전체 관리 파일과 미추적 파일 검사(CI·커밋 후용).
  `--all`은 쓰기나 파일 경로 인자와 함께 쓰지 않는다.
- `yarn lint:canary`: 임시 위반 코드로 FSD 경계를 확인한 뒤 자동 정리
- `yarn test`: Vitest + Testing Library 예제
- `yarn playwright install chromium`, `yarn test:e2e`: 브라우저 설치와 E2E 예제

E2E는 사용 가능한 로컬 포트를 골라 프로덕션 빌드·서버로 실행한다.
필요하면 `E2E_PORT=3200 yarn test:e2e`처럼 포트를 지정한다.
폴링이나 Webpack을 강제하지 않으며 Next.js 기본 빌드 경로를 사용한다.

shadcn 구성의 공용 컴포넌트는 `src/shared/ui/index.ts`에서
재수출하고 외부에서는 `@/shared/ui`로만 가져온다.
생성된 `@/shared/ui/button` 같은 깊은 import는 외부에서 public API로,
같은 `shared/ui` 안에서는 상대경로로 바꾼다. 경계 lint 예외는 추가하지 않는다.

검증 실행은 `AGENTS.md`의 승인 규칙을 따른다. P0 예제는 기반 설정을
확인하므로 기능 요구사항의 SCN을 임의로 연결하지 않는다.

화면은 시스템 라이트·다크를 따르며 `html[data-theme="light" | "dark"]`로
강제할 수 있다. 설정의 화면 모드에서 선택하면 브라우저에 저장하고,
시스템 모드에서는 OS 설정 변경을 따른다. 브라우저 상단바 색도 현재 테마의 배경 토큰을 따른다.
매니페스트·초기 메타데이터는 앱 `tokens.css`에서 색을 읽으며,
앱 TS/TSX의 색 리터럴은 ESLint가 차단한다. 폰트는 스위트 jsDelivr CDN을 쓰고 셀프 호스팅하지 않는다(사용자 결정).

개발 서버의 `/dev/components`에서 모든 공용 UI와 빈 값·로딩·오류 상태를
라이트·다크로 나란히 볼 수 있다. 이 경로는 프로덕션에서 404로 막는다.
시트·확인창·알림·수량·선택 컨트롤은 직접 조작할 수 있다.
앱 셸은 1024px 미만에서 하단 탭 바, 그 이상에서 248px 사이드바를 쓴다.
일정·재고·장바구니는 다음 Phase를 위한 빈 화면이며 가짜 데이터를 표시하지 않는다.
앱 실행 스플래시는 개발 카탈로그에서 미리 볼 수 있다. 인증·가정 정보를 확인하는 동안에는 목록 스켈레톤을 표시한다.

공용 UI는 `@/shared/ui`로 가져온다. `ConfirmDialog`는 `targetName`과
제목·설명을 받고, 실행 후 닫기는 호출자가 `open`으로 제어한다.
`Sheet`·`ConfirmDialog`는 Radix 프리미티브(`radix-ui`)를 직접 쓰고 토큰에 맞춘
`kj-*` CSS로 외형을 입혔으며, 포커스 가두기·복귀와 Esc 닫기를 제공한다. `Toast`는 루트의
`ToastProvider` 아래에서 사용하며 되돌리기 콜백을 받을 수 있다.
`FormFieldRow`는 render prop으로 입력의 `id`·`aria-invalid`·`aria-describedby`를
전달한다. 입력에 `controlProps`를 펼치면 라벨과 오류가 함께 연결된다.

```tsx
<FormFieldRow label="이름" htmlFor="name" invalid error="이름을 입력해 주세요">
  {(controlProps) => <input {...controlProps} defaultValue="" />}
</FormFieldRow>
```

P2 실행에는 `.env.example`의 Supabase URL과 공개 anon 키를 `.env.local`에
설정하고 [DB 준비 안내](./supabase/README.md)에 따라 마이그레이션을 적용해야 한다.
서비스 역할 키는 앱에서 사용하지 않는다. `/login` → `/onboarding`에서
로그인·필수 동의·표시 이름·가정 생성을 진행하고 `/family`에서 구성원과
초대 링크를 관리한다. `/invite/<token>`은 로그인 전에도 링크 상태를 보여 주고,
로그인과 동의를 마친 뒤 수락한다. 약관·개인정보 문서는 `/terms`, `/privacy`의
개발용 초안이다. 로그인에 사용한 수단이 다르면 별개 계정이다.

홈에 브라우저별 설치 안내를 표시하고, 지원 브라우저에서는 설치 버튼을 제공한다.
설치된 앱에서는 안내를 숨긴다. 알림 권한 요청은 P5 범위로 남긴다.
서비스 워커는 프로덕션에서만 등록하며, 아직 캐시·오프라인·푸시 동작은 없다.

- 작업 규칙과 문서 우선순위: [`AGENTS.md`](./AGENTS.md)
- 문서 목록: [`docs/README.md`](./docs/README.md)
- 요구사항: [`docs/01-project/REQUIREMENTS.md`](./docs/01-project/REQUIREMENTS.md)
- 미결 결정: [`docs/04-planning/DECISIONS_REQUIRED.md`](./docs/04-planning/DECISIONS_REQUIRED.md)
