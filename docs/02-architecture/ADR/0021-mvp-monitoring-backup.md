# 0021. MVP 오류 모니터링과 주간 DB 백업

Status: CONFIRMED (방식·주기·4주 보관, 사용자 결정 2026-11-11). 운영 적용 대기.

## 결정

- 오류 모니터링은 Sentry 무료 플랜과 `@sentry/nextjs` 11.11.0을 사용한다. 기존 Vercel의 안전한 서버 오류 로그는 유지한다. DEC-013의 P10 범위를 대체한다.
- 브라우저·React 경계·서버 오류와 공용 라우트에서 처리한 5xx 오류를 연결한다. 오류 종류·코드 위치만 허용 목록으로 재구성하고 사용자·요청·쿠키·원문 메시지·탐색 기록·첨부는 제거한다. tracing·replay·로그·메트릭 전송 및 소스맵 업로드는 사용하지 않는다. DSN이 없거나 개발 환경이면 전송하지 않는다.
- 서버·브라우저는 `NEXT_PUBLIC_SENTRY_DSN`을 사용한다. 실제 DSN은 운영 환경에서 설정하고 저장소에는 이름만 둔다. 소스맵 업로드 인증 토큰은 필요하지 않다.
- 백업은 맥미니 launchd가 주 1회 pg_dump를 받아 로컬 파일로 보관한다. 인증 파일·덤프는 저장소 밖에서 본인만 접근하게 한다. 대화·첨부·실행 원문은 백업하지 않는다.
- 주 1회 백업을 4주 치 보관하며 스크립트 기본값과 launchd 설정은 4주로 둔다. 운영 프로젝트 생성·배포·백업 등록·원격 덤프는 이번 구현에서 실행하지 않는다.

## 확인과 남은 일

개인정보 제외 단위 테스트와 실패 시 기존 덤프를 지우지 않는 백업 self-check를 둔다. Sentry 실제 수신·맥미니 예약 실행·로컬 복구 연습은 운영 담당자가 확인해야 한다. 개인정보 처리방침에 백업 4주 보관과 Sentry·OpenAI(미국)의 국외 이전 항목을 반영한다.

백업 범위·설치·복구 한계는 [BACKUP_PLAN.md](../../04-planning/BACKUP_PLAN.md)를 따른다. Sentry 초기화는 [공식 Next.js 설정](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)과 [v11 변경](https://docs.sentry.io/platforms/javascript/guides/nextjs/migration/v10-to-v11/)에 따른다.
