# 0002. 코드 구조: Feature-Sliced Design

- 결정 ID: ADR-0002
- 결정 날짜: 2026-10-14 (`AGENTS.md` 반영일. 실제 결정일은 확인 필요)
- 상태: Accepted

## 배경
AI 코딩 에이전트와 함께 개발하므로 파일을 어디에 둘지 일관된 기준과 기계적으로 강제 가능한 경계가 필요하다. 이전 프로젝트(`unas-react`)에서 FSD 전환 규칙을 쓴 경험이 있다.

## 검토한 대안
이전 프로젝트의 종류별 최상위 폴더(`api/`, `stores/`, `hooks/`, `components/`)는 채택하지 않기로 했다(`CODING_STANDARDS.md` "옮기지 않은 것").

## 최종 결정
FSD를 따른다. 레이어는 `app`, `pages`, `widgets`, `features`, `entities`, `shared`(`processes` 미사용). import는 위에서 아래로만, 같은 레이어 슬라이스 간 import 금지(entity는 `@x`만), 슬라이스 밖에서는 `index.ts`만 사용. 경계는 린트로 강제한다. Next.js 라우트는 루트 `app/`에 얇게 두고 `src/pages`를 재수출한다.

## 결정 이유
권한 규칙처럼 화면과 챗봇이 함께 쓰는 로직을 entity 서버 함수 한 곳에 모으기 쉽고, 경계 위반을 린트로 잡을 수 있다.

## 예상 영향
- 슬라이스가 같은 레이어끼리 막히는 경우 조립 지점(widget/page)이 필요하다. 상세 규칙은 `FSD.md`.
- 린트 도구(`eslint-plugin-boundaries`)는 아직 PROPOSED다 → `TECH_STACK.md`.
- 폴더·슬라이스 이름은 초기 세팅 때 확정한다.
