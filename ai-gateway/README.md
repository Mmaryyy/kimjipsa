# 김집사 맥미니 워커

앱의 가족 작업을 받아 설치된 Hermes의 `kimjipsa` 전용 프로필에서 처리한다. 앱에는 제공자·모델·API 키 입력이 없다. 기존 Hermes 기본 프로필의 모델 설정을 실행마다 읽으며 인증은 Hermes의 공용 인증 저장소를 사용한다. 개인 대화·기억·메신저 설정은 복사하지 않는다.

## 실행

저장소 루트에서 `yarn gateway:start`.

- 워커 상태: `http://127.0.0.1:8644/health`. `ready`/`running`이면 200이다.
- 공용 Hermes API: `127.0.0.1:8643`. 워커가 지속 실행하며 루프백 인증을 적용한다. 개인·사진·검색 처리는 기억이 꺼진 `kimjipsa-private` 프로필과 `8645`에서 분리한다.
- 전용 프로필: `~/.hermes/profiles/kimjipsa`. `gateway.standalone`으로 개인 게이트웨이와 별도로 실행한다.
- 기본 모델을 Hermes에서 바꾸면 다음 작업 실행에 반영한다. 앱에 설정을 복사하지 않는다.
- 워커는 Supabase의 전용 계정으로 인증한다. 비밀번호는 macOS Keychain의 `kimjipsa-ai-gateway` 서비스에서 읽는다.
- `config.local.json`은 Git에서 제외한다. 앱 URL, 공개 Supabase 설정, 워커 이메일, Hermes 실행기·Python·프로필 경로만 담는다. 검색용 `hermesSource`는 기본값 `~/.hermes/hermes-agent`이며 다른 설치 위치에서는 지정한다. 모델 키·service_role은 넣지 않는다.

현재 앱 주소는 `http://localhost:3000`이다. Next.js가 루프백 IP를 `localhost`로 정규화하므로 `appUrl`에도 `localhost`를 사용해야 쓰기 요청의 Origin 검사를 통과한다. 서버는 `127.0.0.1`에만 바인딩한다. 운영 앱을 사용하려면 `appUrl`을 그 HTTPS origin으로 바꾼다. Hermes는 설치된 공식 실행기로 시작한다. Python 경로는 `ruamel.yaml`이 들어 있는 Hermes 관리 런타임을 가리킨다. Hermes 업데이트가 해당 경로를 바꾸면 이 경로도 맞춰야 한다.

## 처음 설치할 때

1. `supabase/migrations`의 적용 이력을 비교해 미적용 파일만 순서대로 실행한다. `20261104040000_hermes_shared_read.sql`은 스킬의 읽기 전용 RPC를 추가한다. 이미 적용된 파일은 다시 실행하지 않는다. 직접 DB 연결과 이력 관리는 [Supabase README](../supabase/README.md)를 따른다.
2. 앱 서버에는 Supabase 설정, 파일 정리용 `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`을 둔다. 모델 키와 `SECRET_ENCRYPTION_KEY`는 사용하지 않는다.
3. `config.example.json`을 `config.local.json`으로 복사하고 이 컴퓨터의 경로·연결 정보를 넣는다.
4. 전용 워커를 한 번 등록한다. 기존 워커는 중복 생성하지 않는다.

   ```sh
   node --experimental-strip-types ai-gateway/scripts/register-worker.mts FAMILY_UUID
   ```

5. 빈 Hermes 프로필을 생성한다. 개인 프로필을 clone하지 않는다.

   ```sh
   hermes profile create kimjipsa --no-skills --no-alias
   touch ~/.hermes/profiles/kimjipsa/.kimjipsa-managed
   ```

6. 워커가 `scripts/prepare-profile.py`로 기본 모델과 전용 API 설정을 맞춘다. 기존 Hermes 기본 프로필은 모델과 로그인이 이미 구성돼 있어야 한다. 새 가정용 자격증명 입력은 없다.
7. `yarn gateway:start`로 시작한다.

기본 연결은 `/api/agent/config`의 `connectionMode=local`과 워커 health로 확인한다. Hermes는 설치된 실행기를 사용하며 예전에 내보낸 `vendor/` 소스는 실행에 사용하지 않는다.

## 실행 권한과 기록

공용 API에는 `memory`, `skills`, `kimjipsa` 도구만 허용한다. 임의 셸·파일·MCP 도구는 앱 요청에서 사용하지 않는다. 작업 문맥과 변경 결과는 `/api/agent/context`·`/api/agent/complete`와 가정·작업 임대로 제한된 Supabase RPC를 사용한다. 일정 조회·등록·변경, 장바구니 조회·추가·구매 완료, 재고 조회·추가·차감·수정·삭제를 지원한다. 개인 일정은 ‘나만 보기’에서만 제공한다. 영수증은 사용자가 확인해야 반영된다.

Supabase는 앱 대화·가족 기억의 원본이고, Hermes 자체 기억은 공용 프로필의 `memories/`에 별도로 보관한다. 앱의 기억 끄기·삭제·초기화는 Supabase에만 적용하며 Hermes 기억은 Hermes에서 관리한다. 공용 프로필과 디스코드 설정·스킬·기억을 작업 뒤 지우지 않는다. 앱의 개별 세션만 API로 정리하고, 임시 개인 프로필은 종료 후 삭제한다. 같은 프로필에 두 게이트웨이를 동시에 띄우지 않는다. 디스코드는 이 공용 게이트웨이에 설정하여 사용한다.

## Supabase 조회 스킬

`kimjipsa-supabase` 스킬이 `kimjipsa_read` 도구로 가족 기억·재고·장바구니·공용 일정/개인 일정의 가려진 상태를 조회한다. 스킬은 `skills/`, 도구는 `hermes-plugin/`에서 관리하고 프로필 준비 시 설치한다. 도구는 로컬 토큰으로 워커의 `/hermes/read`를 호출하고, 워커는 자신의 Supabase 세션으로 앱의 `/api/agent/read`를 호출한다. RPC는 등록·활성화된 워커의 가정만 조회한다. DB 비밀번호나 service_role은 사용하지 않는다.

스킬의 정보가 최신 상태이며 Hermes 자체 기억은 참고 정보다. Supabase 데이터를 자체 기억에 자동 복사하지 않는다. ‘나만 보기’·사진·검색 처리는 자체 기억과 이 도구가 없는 별도 프로필에서 실행하므로 공용 프로필에 개인 내용을 전달하지 않는다. 일반 Hermes·디스코드의 조회 스킬은 읽기 전용이며, 앱의 변경 작업은 기존 확인·권한 검사를 유지한다.

임대는 90초, 갱신은 20초다. 취소·설정 변경·만료 이후의 결과 저장은 거부한다. 모든 일정·재고·장바구니 쓰기와 결과 기록은 한 트랜잭션에 있다. 만료된 작업에 변경 기록이 없으면 실패로 정리하고, 기록이 있는 상태 불명 작업은 자동 재실행하지 않는다. Realtime 재연결·작업 종료·60초 보정 조회로 누락된 신호를 복구한다.

## 웹 검색

설치된 Hermes의 검색 설정·인증을 자동 사용한다. 검색 도구를 모델에 직접 열지 않고 `scripts/search-web.py`가 검색어 하나만 받아 호출한다. 현재 요청에 없는 가족 정보로 검색어를 만들 수 없으며, 결과 요약·출처 링크만 별도 읽기 답변에 사용한다. 모델 검색 결과로 변경 작업을 실행하지 않는다. 빈 결과는 근거가 없음을 안내하고 검색 장애는 `web_search_unavailable`로 표시한다.

## 자동 실행과 복구

앱 서버와 워커를 사용자 launchd 작업으로 등록한다. 터미널·Codex를 닫아도 실행하며, 프로세스가 종료되면 다시 시작한다. 앱 URL이 로컬 주소이므로 앱 서버도 함께 실행해야 한다.

자동 실행 프로세스가 데스크탑 폴더 접근 승인에 멈추지 않도록 실행 파일은 `~/Library/Application Support/kimjipsa`에 복사한다. 소스 저장소는 그대로 둔다. 실행 폴더 권한은 `0700`, 환경 파일·워커 설정은 `0600`이다. Keychain의 비밀번호는 복사하지 않는다.

저장소 루트에서 설치하거나, 코드를 수정한 뒤 실행 복사본을 갱신한다. 두 서비스가 잠시 중단되므로 처리 중인 채팅이 끝난 뒤 실행한다.

```sh
python3 ai-gateway/scripts/install-launchd.py
```

설치 스크립트는 앱의 `app/`·`pages/`·`src/`와 인증용 `proxy.ts`, 의존성·설정·워커를 함께 복사한다. 루트 `pages/`가 빠지면 Next.js가 FSD의 `src/pages`를 라우터로 읽어 앱이 종료된다. 실행 폴더 안의 파일을 직접 개발하지 않고 소스를 고친 뒤 설치 스크립트를 다시 실행한다. `launchd/`의 두 plist는 이 컴퓨터의 Node 경로를 사용하며 설치 시 작업 경로를 실행 폴더로 치환한다.

로그는 실행 폴더의 `ai-gateway/.runtime/` 안에 `local-app.log`, `local-app-error.log`, `worker.log`, `worker-error.log`로 남는다. 워커 상태는 위 `/health`에서 확인한다. 로컬 앱의 `/api/agent/config`에 인증 없이 접근하면 `401`이 정상이다. 자동 실행 중에는 같은 포트에 `yarn dev`·`yarn gateway:start`를 중복 실행하지 않는다.

현재 워커 PID는 `.runtime/worker.pid`에 기록한다. SIGTERM으로 종료하면 전용 Hermes도 종료·정리한다. 강제 종료로 자식만 남으면 해당 `kimjipsa` 전용 프로세스를 종료한 뒤 워커를 재시작한다. 개인 게이트웨이를 종료하지 않는다. launchd는 로그인 후 시작하며 전원·절전 설정은 별도다.

`gateway_migration_required`는 후속 SQL이 없는 상태, `local_model_configuration_failed`는 로컬 프로필·Python·모델 설정 문제다. `hermes_start_failed`는 포트·프로필 실행 상태를 확인한다. 워커 비밀번호를 바꿀 때는 Supabase Auth와 Keychain을 함께 갱신한다.

## 검증

사용자가 승인한 범위에서 타입 검사·변경 파일 린트를 실행한다. SQL 통합 테스트 `supabase/tests/family_agent.sql`, `agent_capabilities.sql`, `cart_restock_undo.sql`은 모든 마이그레이션을 적용한 폐기 가능한 DB에서 승인 후 실행한다. 개인 채팅·일정 권한, 중복 실행, 임대·확인 만료, 변경 충돌, 원자적 구매·재고 반영을 검사한다. 이번 검사는 임시 PGlite PostgreSQL 환경에서 통과했다. Auth·Storage·Realtime·pgmq·cron 연동은 대체했으며 실제 Supabase 네트워크 E2E와 구분한다.

Vitest는 앱의 일정 필터·입력 검증·확인 UI와 검색 프로세스 격리를 검사한다. 검색 테스트는 Hermes 검색 백엔드만 대체하며 실제 키나 검색 API를 호출하지 않는다. Playwright의 `chat-capabilities.spec.ts`는 API를 대체해 모바일·데스크톱에서 모드 전환과 초안 분리, 전송 모드, 출처 링크를 확인한다.

실제 모델의 텍스트·사진 왕복과 두 사용자의 동시 확인·취소는 별도 인수 항목이다. 모델 키 입력 화면을 다시 추가하지 않는다.
