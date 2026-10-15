# 김집사 (kimjipsa)

신혼부부가 일정, 재고, 장바구니를 같이 관리하고 AI 집사 챗봇이 조회·실행·제안까지 해 주는 가정 관리 서비스. 모바일 우선 PWA(Next.js, Supabase, Vercel).

P0 초기 앱과 개발 도구를 구성했다. 도메인 기능은 이후 Phase에서 구현한다.

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

P1에서 shadcn 컴포넌트를 추가할 때는 `src/shared/ui/index.ts`에서
재수출하고 외부에서는 `@/shared/ui`로만 가져온다.
생성된 `@/shared/ui/button` 같은 깊은 import는 외부에서 public API로,
같은 `shared/ui` 안에서는 상대경로로 바꾼다. 경계 lint 예외는 추가하지 않는다.

검증 실행은 `AGENTS.md`의 승인 규칙을 따른다. P0 예제는 기반 설정을
확인하므로 기능 요구사항의 SCN을 임의로 연결하지 않는다.

화면은 시스템 라이트·다크를 따르며 `html[data-theme="light" | "dark"]`로
강제할 수 있다. 브라우저 상단바 색도 현재 테마의 배경 토큰을 따른다.
매니페스트·초기 메타데이터는 앱 `tokens.css`에서 색을 읽으며,
앱 TS/TSX의 색 리터럴은 ESLint가 차단한다. 폰트는 스위트 jsDelivr CDN을 쓰고 셀프 호스팅하지 않는다(사용자 결정).
서비스 워커는 프로덕션에서만 등록하며, P0에서는 캐시·오프라인·푸시 동작이 없다.

- 작업 규칙과 문서 우선순위: [`AGENTS.md`](./AGENTS.md)
- 문서 목록: [`docs/README.md`](./docs/README.md)
- 요구사항: [`docs/01-project/REQUIREMENTS.md`](./docs/01-project/REQUIREMENTS.md)
- 미결 결정: [`docs/04-planning/DECISIONS_REQUIRED.md`](./docs/04-planning/DECISIONS_REQUIRED.md)
