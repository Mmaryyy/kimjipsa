# 0008. FSD 경계 강제: eslint-plugin-boundaries

- 결정 ID: ADR-0008
- 결정 날짜: 2026-10-15
- 상태: Accepted

## 배경
ADR-0002가 FSD를 코드 구조로 정했고, `FSD.md` §7은 경계를 린트로 강제하기로 했다. 그 도구는 `TECH_STACK.md`에서 PROPOSED였다. P0(프로젝트 초기화)가 "FSD 경계 위반이 lint에서 잡힌다"를 목표로 하므로 도구를 확정해야 했다. 사용자가 이 도구를 포함한 P0 계획을 승인했고, P0 코드 리뷰(r002-f9)에서 확정 기록을 남기기로 했다.

## 검토한 대안
`@feature-sliced/eslint-config`, steiger

## 최종 결정
- `eslint-plugin-boundaries` 7.2.0을 쓴다. 버전은 `package.json`에 고정한다.
- 규칙은 `error` 수준이다. 레이어 방향, 슬라이스 간 import 금지, public API(깊은 import 금지), entity 간 `@x` 타입 예외를 `eslint.config.mjs`의 `dependencies` 규칙으로 표현한다.
- 규칙이 실제로 위반을 잡는지는 임시 위반 코드를 만들었다 지우는 canary 스크립트(`yarn lint:canary`)로 확인한다.

## 결정 이유
`FSD.md` §7이 이 플러그인을 가정하고 작성돼 있고, 레이어·슬라이스·public API를 한 설정에서 표현할 수 있다. 위반을 CI나 리뷰가 아니라 작성 시점의 lint에서 막는 것이 목표다.

## 예상 영향
- `FSD.md`의 경계 규칙을 바꾸면 `eslint.config.mjs`와 canary 사례를 함께 고친다.
- 새 슬라이스·세그먼트를 만들 때 경계 규칙이 알 수 없는 파일을 `error`로 막는다.
- 플러그인 메이저 버전을 올릴 때는 설정 형식 변경 여부를 먼저 확인한다.
