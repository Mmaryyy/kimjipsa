# ADR (Architecture Decision Records)

사용자가 승인한 주요 기술 결정만 기록한다. **승인되지 않은 제안은 ADR로 쓰지 않는다.** 제안은 `docs/04-planning/DECISIONS_REQUIRED.md`에서 승인될 때까지 PENDING으로 둔다.

- 파일명: `NNNN-제목.md` (예: `0001-platform-stack.md`)
- 상태: `Accepted` / `Superseded by NNNN`
- 결정을 바꿀 때는 기존 ADR을 고치지 않고 새 ADR을 쓰고 이전 것을 `Superseded`로 바꾼다.

## 템플릿

```markdown
# NNNN. 제목

- 결정 ID: ADR-NNNN (관련 DEC: DEC-xxx)
- 결정 날짜: YYYY-MM-DD
- 상태: Accepted

## 배경
## 검토한 대안
## 최종 결정
## 결정 이유
## 예상 영향
```

## 목록

| ID | 제목 | 날짜 | 상태 |
| --- | --- | --- | --- |
| [0001](./0001-platform-stack.md) | 플랫폼 스택: PWA + Next.js + Supabase + Vercel | 2026-10-14 | Accepted |
| [0002](./0002-feature-sliced-design.md) | 코드 구조: FSD | 2026-10-14 | Accepted |
| [0003](./0003-byok-server-side-ai.md) | AI: BYOK + 서버 라우트 호출 + 요청자 권한 필터 | 2026-10-14 | Accepted |
| [0004](./0004-frontend-stack.md) | 언어·스타일링·UI·날짜: TypeScript + Tailwind/CVA + shadcn/ui + date-fns | 2026-10-14 | Accepted |
| [0005](./0005-server-state-validation.md) | 서버 상태·검증: TanStack Query + Zod | 2026-10-14 | Accepted |
| [0006](./0006-test-tools.md) | 테스트 도구: Vitest + Testing Library + Playwright | 2026-10-14 | Accepted |
| [0007](./0007-package-manager-yarn.md) | 패키지 매니저: Yarn 4 (node-modules) | 2026-10-14 | Accepted |
| [0008](./0008-fsd-boundary-lint.md) | FSD 경계 강제: eslint-plugin-boundaries | 2026-10-15 | Accepted |
| [0009](./0009-separate-accounts-per-login-method.md) | 로그인 수단별 별개 계정: 카카오 이메일 미수집 + 제공자 id 구분 | 2026-10-15 | Accepted |
| [0010](./0010-fsd-server-entry-points.md) | FSD 서버 전용 진입점: index.server.ts와 shared/server | 2026-10-16 | Accepted |
| [0011](./0011-react-hook-form.md) | 폼: React Hook Form + @hookform/resolvers(Zod) | 2026-10-16 | Accepted |
| [0012](./0012-event-time-detail-split.md) | 개인 일정 보호: 시간 테이블과 내용 테이블 분리 | 2026-10-16 | Accepted |
| [0013](./0013-scheduled-jobs-pg-cron.md) | 예약 작업: Supabase pg_cron + 서버 라우트 | 2026-10-20 | Accepted |
| [0014](./0014-public-holidays-data-go-kr.md) | 공휴일 데이터: 공공데이터포털 특일정보 API | 2026-10-20 | Accepted |
| [0015](./0015-calendar-swipe-embla.md) | 달력 스와이프: embla-carousel-react | 2026-10-20 | Accepted |
| [0016](./0016-server-secret-encryption-aes-gcm.md) | 서버 저장 비밀값 암호화: 앱 레벨 AES-GCM | 2026-10-30 | Accepted |

0001~0003의 날짜는 결정이 `AGENTS.md`의 "확정된 주요 결정"에 반영된 날(커밋 c1281e5)이다. 실제 결정일을 아는 경우 고친다. 0004~0007은 사용자가 승인한 날이다.

- [0017. 가족 공용 집사와 맥미니 실행 워커](0017-local-family-agent.md) — CONFIRMED (2026-11-04)
- [0018. Hermes 자체 기억과 Supabase 조회 스킬](0018-hermes-memory-and-household-skill.md) — CONFIRMED (2026-11-04)
- [0019. AI Elements 대화 화면](0019-ai-elements-chat.md) — CONFIRMED (2026-11-04)

- [0020. 카테고리 직접 색 선택](0020-react-colorful-color-picker.md) — CONFIRMED (2026-11-09)

- [0022. 폼 시트 컴포넌트와 전역 확인창](0022-form-sheet-and-global-confirm.md) — CONFIRMED (2026-11-12)
