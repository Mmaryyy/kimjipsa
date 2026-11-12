# 김집사 문서

디자인·개발의 기준 문서입니다. 기획서·명세 HTML은 claude.ai 아티팩트의 복사본이며, 아티팩트가 원본입니다. 내용을 바꾸면 양쪽을 같이 맞춰 주세요. 작업 규칙과 문서 우선순위는 저장소 루트의 `AGENTS.md`를 봅니다.

## 원본 문서

| 파일            | 내용                                               | 버전  | 아티팩트                                          |
| --------------- | -------------------------------------------------- | ----- | ------------------------------------------------- |
| `기획서.html`   | 서비스 기획서                                      | v0.11 | https://claude.ai/artifact/QQ31umsyEzybzhsNa2cpWD |
| `기능명세.html` | 기능 명세(요구사항 ID, 확인 시나리오, 데이터 항목) | v0.11 | https://claude.ai/artifact/S11NoCQitfDNyyDQRotbEn |

결정 목록(`04-planning/DECISIONS_REQUIRED.md`)은 읽기용 페이지로도 올려 두었습니다: https://claude.ai/artifact/LKwdaPYEExPrbAUPraoGNR (원본은 md, 바뀌면 페이지를 다시 올립니다)

> 기획서 §09에 `docs/fsd.md`라는 경로가 남아 있습니다. 파일은 `02-architecture/FSD.md`로 옮겼습니다. 다음 기획서 개정 때 아티팩트와 복사본을 함께 고칩니다.

## 개발 문서

모두 로컬 전용이며 상태 표기는 `CONFIRMED` / `PROPOSED` / `PENDING`입니다.

| 폴더               | 파일                      | 내용                                                                                            |
| ------------------ | ------------------------- | ----------------------------------------------------------------------------------------------- |
| `01-project/`      | `PROJECT.md`              | 서비스 정체성, 사용자, 설계 원칙, 시나리오, 리스크                                              |
|                    | `REQUIREMENTS.md`         | 요구사항 ID 색인(명세 정리본), 비기능 요구사항                                                  |
|                    | `GLOSSARY.md`             | 용어와 코드 식별자                                                                              |
| `02-architecture/` | `ARCHITECTURE.md`         | 시스템 구성, 책임 분담, 설계 규칙                                                               |
|                    | `FSD.md`                  | FSD 구조 가이드(레이어, 슬라이스 배치안, Next.js 연결, 경계 규칙). 파일을 만들거나 옮길 때 읽음 |
|                    | `TECH_STACK.md`           | 기술별 상태(확정/제안/검토/기각)와 대안                                                         |
|                    | `DATA_MODEL.md`           | 엔티티, 필드, 관계, 제약, 데이터 공백                                                           |
|                    | `ADR/`                    | 승인된 기술 결정 기록                                                                           |
| `03-guidelines/`   | `CODING_STANDARDS.md`     | 코딩 표준(코드 작업 때만 읽음)                                                                  |
|                    | `COMPONENT_NAMING.md`     | 컴포넌트 유형별 네이밍, 시맨틱 HTML·접근성, 구현 전후 확인(코드 작업 때만 읽음)                  |
|                    | `DESIGN_SYSTEM.md`        | UI/UX 원칙, 화면 패턴, 상태 UI (토큰은 `design/` 참고)                                          |
|                    | `API_CONVENTIONS.md`      | 서버 라우트·API 규칙                                                                            |
|                    | `STATE_MANAGEMENT.md`     | 상태 종류별 기준                                                                                |
|                    | `TESTING.md`              | 테스트 전략, 요구사항 ID 연결                                                                   |
| `design/`          | `HANDOFF.md`              | 디자인 → 구현 인계. UI 작업 전에 먼저 읽음                                                      |
|                    | `DESIGN.md`, `tokens.css` | 디자인 규칙과 토큰 원본                                                                         |
|                    | `prototype/`              | 화면 프로토타입·컴포넌트 카탈로그(참고용 HTML)                                                  |
| `04-planning/`     | `ROADMAP.md`              | 단계, 선후 관계, 선행 결정, 완료 조건                                                           |
|                    | `DECISIONS_REQUIRED.md`   | 사용자 결정이 필요한 사항(DEC-001~)                                                             |
|                    | `BACKUP_PLAN.md`          | 맥미니 주간 DB 백업·설치·복구 절차(운영 적용 대기, DEC-013)                                                     |
|                    | `ANNOUNCEMENT.md`         | 운영 공지 푸시 보내는 법(`yarn announce`, 파일·예약 발송)                                        |

AI 스킬은 저장소 루트 `.agents/skills/`에 있습니다(`.claude/skills`는 심볼릭 링크).

## 맥미니 연동 계획

2026-11-04 사용자가 앱·맥미니 구현과 보관 정책을 승인했습니다. 구체 결정은 [ADR-0017](02-architecture/ADR/0017-local-family-agent.md), 적용·검증 상태는 [구현 진행 상태](04-planning/mac-mini/IMPLEMENTATION.md)를 봅니다. 아래 첨부 계획 원문은 보존합니다.

- [앱과 클라우드 구현 계획](04-planning/mac-mini/kimjipsa-app-plan.md): 앱에 추가할 기능과 Vercel·Supabase 작업
- [맥미니 구현 계획](04-planning/mac-mini/kimjipsa-mac-mini-plan.md): 로컬 Hermes·워커 개발과 운영
- [공통 연동 규약](04-planning/mac-mini/kimjipsa-integration-contract.md): 두 환경의 API·이벤트·작업 상태와 복구 규칙

요구사항 ID는 `CAL`(일정), `INV`(재고), `CART`(장바구니), `BOT`(챗봇), `ACC`(가정·계정) 접두사를 씁니다.
