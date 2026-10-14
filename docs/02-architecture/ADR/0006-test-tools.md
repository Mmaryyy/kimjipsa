# 0006. 테스트 도구: Vitest + Testing Library + Playwright

- 결정 ID: ADR-0006 (관련 DEC: DEC-007)
- 결정 날짜: 2026-10-14
- 상태: Accepted

## 배경
`TESTING.md`는 도구와 무관하게 쓰여 있었다. 두 사용자 실시간 시나리오(SCN-CART-1, SCN-CAL-2)와 권한 필터를 검증해야 한다.

## 검토한 대안
Jest 계열, Cypress

## 최종 결정
- 단위·컴포넌트: Vitest + Testing Library
- E2E: Playwright (두 브라우저 컨텍스트로 두 사용자 흐름 검증)
- CI 구성은 이 결정에 포함하지 않는다. 배포 설정이므로 따로 승인받는다.

## 결정 이유
Next.js·TypeScript 환경에서 설정이 가볍고, Playwright는 한 테스트 안에서 두 사용자 세션을 다룰 수 있다.

## 예상 영향
- `TESTING.md`, `write-tests` 스킬이 이 도구를 기준으로 한다.
- 테스트 실행은 여전히 사용자 승인 뒤에만 한다(`AGENTS.md`).
