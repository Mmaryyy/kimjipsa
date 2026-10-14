# 0007. 패키지 매니저: Yarn 4 (node-modules 링커)

- 결정 ID: ADR-0007
- 결정 날짜: 2026-10-14
- 상태: Accepted

## 배경
프로젝트 초기화 전에 패키지 매니저를 정해야 한다. 작업 규칙(`AGENTS.md`)의 포매팅 명령도 여기에 따른다.

## 검토한 대안
npm, pnpm

## 최종 결정
- Yarn 4(Berry)를 쓰고 corepack과 `package.json`의 `packageManager` 필드로 버전을 고정한다.
- `.yarnrc.yml`에 `nodeLinker: node-modules`를 둔다. PnP는 쓰지 않는다.
- 스크립트는 `yarn <script>`로 실행한다. 포매팅은 `yarn format`, `yarn format:check`.

## 결정 이유
사용자 선택. PnP는 Next.js·shadcn CLI·일부 도구와 자주 어긋나서 node-modules 링커를 쓴다.

## 예상 영향
- `AGENTS.md`, `CODING_STANDARDS.md`, 스킬의 `npm run` 표기를 `yarn`으로 바꾼다.
- Vercel은 `yarn.lock`과 `packageManager` 필드로 Yarn 4를 인식한다.
