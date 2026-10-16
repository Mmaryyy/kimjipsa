# 0010. FSD 서버 전용 진입점: index.server.ts와 shared/server

- 결정 ID: ADR-0010 (관련: ADR-0002, ADR-0008, P2 코드 리뷰 r007-f7)
- 결정 날짜: 2026-10-16
- 상태: Accepted

## 배경
P2에서 인증·가정 서버 코드가 생겼다. `shared/server`에 가정·초대 도메인 문구가 섞여 `FSD.md`의 "shared는 도메인을 모른다" 규칙을 어겼고(r007-f7), 슬라이스의 클라이언트용 `index.ts`가 서버 전용 코드를 재export하면 `server-only` 모듈이 브라우저 번들에 연결될 위험이 있었다. `FSD.md` §7의 허용 세그먼트(`api`, `ui`, `lib`, `config`, `pwa`)에는 서버 전용 진입점이 없었다. 코드 수정 중 Codex가 규칙과 린트 예외를 추가했고, 사용자가 이를 승인하며 기록을 요청했다.

## 검토한 대안
- 도메인 오류 문구를 `shared/server`에 그대로 둔다: FSD shared 규칙 위반이라 제외.
- 서버 코드를 `app` 레이어에만 둔다: entity가 자기 DB 접근과 오류 매핑을 가져야 해서 제외.

## 최종 결정
- 서버 전용 함수는 슬라이스의 `index.server.ts`를 별도 public API로 쓴다. `app` 레이어에서만 import하고, 클라이언트용 `index.ts`에서는 재export하지 않는다.
- `shared/server`는 서버 전용 Supabase 클라이언트, 세션 갱신, 범용 라우트 처리의 진입점으로 허용한다. 도메인 오류 코드와 문구는 해당 entity의 `api/server.ts`에 둔다.
- 프록시는 `shared/server/index.proxy.ts`의 별도 public API만 쓴다. `next/headers`와 라우트 전용 코드를 가져오지 않는다.
- `eslint.config.mjs`에는 `app` 레이어가 entity의 `index.server.ts`에 접근하는 예외만 둔다.

## 결정 이유
서버 전용 코드가 클라이언트 번들에 섞이는 것을 막고, 도메인 지식을 shared 밖(entity)에 둔다.

## 예상 영향
- `FSD.md`가 이 두 규칙을 담는다.
- 새 entity가 서버 코드를 가지면 `index.server.ts`를 둔다.
- `yarn lint:canary`는 이 예외가 다른 레이어로 넓어지지 않는지 확인하는 사례를 추가할 수 있다.
