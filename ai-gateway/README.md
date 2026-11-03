# 김집사 맥미니 워커

앱의 가족 작업을 받아 설치된 Hermes의 `kimjipsa` 전용 프로필에서 처리한다. 앱에는 제공자·모델·API 키 입력이 없다. 기존 Hermes 기본 프로필의 모델 설정을 실행마다 읽으며 인증은 Hermes의 공용 인증 저장소를 사용한다. 개인 대화·기억·메신저 설정은 복사하지 않는다.

## 실행

저장소 루트에서 `yarn gateway:start`.

- 워커 상태: `http://127.0.0.1:8644/health`. `ready`/`running`이면 200이다.
- 전용 Hermes API: `127.0.0.1:8643`. 워커가 실행·종료하며 루프백 인증을 적용한다.
- 전용 프로필: `~/.hermes/profiles/kimjipsa`. `gateway.standalone`으로 개인 게이트웨이와 별도로 실행한다.
- 기본 모델을 Hermes에서 바꾸면 다음 작업 실행에 반영한다. 앱에 설정을 복사하지 않는다.
- 워커는 Supabase의 전용 계정으로 인증한다. 비밀번호는 macOS Keychain의 `kimjipsa-ai-gateway` 서비스에서 읽는다.
- `config.local.json`은 Git에서 제외한다. 앱 URL, 공개 Supabase 설정, 워커 이메일, Hermes 실행기·Python·프로필 경로만 담는다. 모델 키·service_role은 넣지 않는다.

현재 앱 주소는 `http://127.0.0.1:3000`이다. 운영 앱을 사용하려면 `appUrl`을 그 HTTPS origin으로 바꾼다. Hermes는 설치된 공식 실행기로 시작한다. Python 경로는 `ruamel.yaml`이 들어 있는 Hermes 관리 런타임을 가리킨다. Hermes 업데이트가 해당 경로를 바꾸면 이 경로도 맞춰야 한다.

## 처음 설치할 때

1. 기존 DB 마이그레이션 뒤에 `20261104000000_family_agent.sql`, `20261104010000_local_gateway_model.sql` 순서로 적용한다. 이미 첫 파일을 적용했다면 두 번째만 실행한다. 후속 SQL은 함수 두 개를 교체하며 기존 재고·대화 데이터는 유지한다.
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

이 컴퓨터는 위 설치를 완료했다. 후속 SQL 적용과 `/api/agent/config`의 `connectionMode=local` 응답, 전용 프로필 API·모델 목록·도구 비활성화를 확인했다. 연결 확인에 사용한 설치 소스 커밋은 `c314285f077e91937c995d419b9fa40af9eb4981`이다. 예전에 내보낸 `vendor/` 소스는 실행에 사용하지 않는다.

## 실행 권한과 기록

범용 도구와 로컬 기억을 끄고 API의 toolsets가 모두 비활성인지 확인한 후에만 가족 데이터를 보낸다. 작업 문맥과 재고 변경은 가정·작업 임대로 제한된 Supabase RPC를 사용한다. 모델이 반환한 수량 추가도 서버에서 요청 인용·단위·가정 범위를 다시 확인한다. 영수증은 사용자가 확인해야 반영된다.

Supabase가 가족 대화·기억의 원본이다. 작업이 끝나면 전용 프로세스를 종료하고 그 프로필의 세션·사진 캐시·응답 DB·실행 로그를 정리한다. 프로필 식별 정보·설정·SOUL은 유지한다. 이 프로필은 앱 전용이므로 별도 CLI 대화를 진행하지 않는다.

임대는 90초, 갱신은 20초다. 취소·설정 변경·만료 이후의 결과 저장은 거부한다. 모든 재고 쓰기와 결과 기록은 한 트랜잭션에 있다. 만료된 작업에 변경 기록이 없으면 실패로 정리하고, 기록이 있는 상태 불명 작업은 자동 재실행하지 않는다. Realtime 재연결·작업 종료·60초 보정 조회로 누락된 신호를 복구한다.

## 자동 실행과 복구

`launchd/com.kimjipsa.ai-gateway.plist`는 이 컴퓨터의 경로로 준비했다. 아직 로그인 항목에 설치하지 않았다. 직접 실행 중인 워커를 종료한 뒤 다음 명령으로 설치할 수 있다.

```sh
mkdir -p ai-gateway/.runtime
cp ai-gateway/launchd/com.kimjipsa.ai-gateway.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.kimjipsa.ai-gateway.plist
```

현재 워커 PID는 `.runtime/worker.pid`에 기록한다. SIGTERM으로 종료하면 전용 Hermes도 종료·정리한다. 강제 종료로 자식만 남으면 해당 `kimjipsa` 전용 프로세스를 종료한 뒤 워커를 재시작한다. 개인 게이트웨이를 종료하지 않는다. launchd는 로그인 후 시작하며 전원·절전 설정은 별도다.

`gateway_migration_required`는 후속 SQL이 없는 상태, `local_model_configuration_failed`는 로컬 프로필·Python·모델 설정 문제다. `hermes_start_failed`는 포트·프로필 실행 상태를 확인한다. 워커 비밀번호를 바꿀 때는 Supabase Auth와 Keychain을 함께 갱신한다.

## 검증

사용자가 승인한 범위에서 타입 검사·변경 파일 린트를 실행한다. SQL 통합 테스트 `supabase/tests/family_agent.sql`은 두 마이그레이션을 적용한 폐기 가능한 DB에서 별도 승인 후 실행한다. 키 없이 전송·선점, 가정 격리, 중복 확인, 임대 만료, 재고 원자성을 검사한다.

실제 모델의 텍스트·사진 왕복과 두 사용자의 동시 확인·취소는 별도 인수 항목이다. 모델 키 입력 화면을 다시 추가하지 않는다.
