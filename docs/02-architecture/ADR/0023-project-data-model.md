# 0023. 가정 공유 프로젝트 데이터 구조

Status: CONFIRMED (2026-11-19 사용자 승인)

> 2026-11-25 변경: 사용자 결정 g193 으로 정산(구성원별 분담 비율·정산 보류)을 빼고 `project_shares` 를 만들지 않는다. 아래 정산 관련 내용은 당시 결정 기록으로 남기며, 현재 구조는 DATA_MODEL.md 를 따른다.

## 맥락

결혼 준비·이사 등 장기 작업을 가정 전체가 공유한다(PRJ-01~14). wedd-dashboard의 고정 영역·두 사람 이름·여행 날짜를 데이터로 일반화한다. PJ0은 구조와 시안만 제안하며 SQL·RPC·Storage 정책은 PJ2~PJ5에서 구현한다. 이 문서를 승인된 결정으로 사용하려면 사용자 ADR 승인이 필요하다.

## 제안하는 결정

### 테이블과 필드

모든 테이블은 `id`, `family_id`를 가진다. 가정 삭제 시 함께 삭제한다. 아래는 계획 §4의 필드이며 PK·FK·검증의 실제 SQL은 후속 Phase에서 작성한다.

| 테이블                      | 필드                                                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projects`                  | title, description, starts_on, target_on, status, modules(text[]), budget_limit, created_by, sort_order                                                         |
| `project_areas`             | project_id, name, sort_order                                                                                                                                    |
| `project_milestones`        | project_id, area_id, title, starts_on, ends_on, is_tentative, memo, event_id                                                                                    |
| `project_tasks`             | project_id, area_id, title, assignee_kind(unassigned/together/member), assignee_id, status, starts_on, due_on, depends_note, memo, completed_by, completed_at   |
| `project_decisions`         | project_id, 질문, 상태, 기한, 후보(글), 최종 선택(PRJ-05)                                                                                                       |
| `project_decision_opinions` | decision_id, user_id, opinion                                                                                                                                   |
| `project_lists`             | project_id, kind(candidates/people), name, columns(jsonb: key·label·type·options), tags(jsonb, people만), quantity_list_id, quantity_tag_key, sort_order        |
| `project_list_items`        | list_id, title, status, price, links(text[]), values(jsonb), tags(text[]), done_tags(text[]), memo, sort_order                                                  |
| `project_reservations`      | project_id, area_id, title, kind, status, starts_on, ends_on, reference_no, links, cancel_deadline, payment_deadline, total_amount, paid_amount, memo, event_id |
| `project_itinerary`         | project_id, starts_on, ends_on, place, title, links, memo, event_id                                                                                             |
| `project_expenses`          | project_id, area_id, title, estimated_amount, planned_on, actual_amount, paid_on, payer_id, cost_type, links, memo                                              |
| `project_shares`            | project_id, user_id, ratio                                                                                                                                      |
| `project_photos`            | item_id, storage_path, thumb_path, created_by                                                                                                                   |

`project_decisions`의 물리 열 이름은 계획 §4에 없어 PJ3에서 PRJ-05의 의미를 유지해 정의한다.

### 권한·쓰기

- 모든 테이블의 조회 RLS는 `family_id = private.current_family_id()`(계획의 `current_family_id()`, 실제 기존 스키마는 private)를 쓴다. 다른 가정의 행·사진·연결은 반환하지 않는다.
- 쓰기는 `supabase/migrations/20261026000000_cart.sql`의 `write_cart` 패턴을 따른 요청자 범위 `security definer` RPC만 허용한다. `search_path = ''`, 인증·가정 확인, 실행 권한 제한, 입력 검증을 유지한다. 클라이언트 입력의 family_id를 신뢰하지 않는다.
- 프로젝트·영역·목록·항목·결정·일정 연결은 family_id를 포함한 복합 FK로 타 가정 연결을 차단한다. 영역·목록 연결은 project_id까지 일치시켜 타 프로젝트 연결도 막는다. user_id 참조는 RPC에서 현재 가정 구성원인지 검증한다.
- 영역 삭제는 area_id만 null로, 일정 삭제는 event_id만 null로 만든다. 복합 FK의 SET NULL은 nullable 참조 열만 대상으로 해 family_id·project_id를 비우지 않는다. 항목은 유지한다.
- 목록 columns의 key·label·type·options와 values를 서버에서 함께 검증한다. type은 글·숫자·금액·선택이며 선택 값은 해당 options에 속해야 한다. links는 기존 http(s) 검증 관례를 따른다.

### 구성 요소·일정 연결

구성 요소를 끄면 데이터는 삭제하지 않고 숨긴다. 할 일·마일스톤은 항상 켠다.

일정 연결은 같은 가정의 공유 일정만 허용한다. 프로젝트 화면·챗봇은 `event_id`로 일정 상세를 조인하지 않는다. 일정이 개인으로 바뀌면 같은 트랜잭션에서 마일스톤·예약·일정표의 연결을 해제하고 프로젝트 항목은 유지한다.

### 명단 + 태그 수량 연결 (r001-f1)

`quantity_list_id`는 같은 프로젝트의 `people` 목록 하나, `quantity_tag_key`는 그 명단에 정의된 태그 하나를 가리킨다. 후보 목록만 이 연결을 가진다. 두 값은 함께 지정하거나 함께 비운다. 다른 명단에서 같은 이름의 태그를 찾거나 가정 전체 태그 인원을 합치지 않는다.

명단 삭제는 FK `on delete set null`로 quantity_list_id를 비우며 삭제 RPC는 quantity_tag_key도 같은 트랜잭션에서 비운다. 태그는 JSON이므로 태그 삭제 RPC가 연결된 후보 목록의 두 열을 같은 트랜잭션에서 null로 만든다. 사람의 tags·done_tags에서도 삭제된 키를 제거한다. 표시 문구는 **수량 기준 없음**이다. 명단 kind 변경·수량 연결 쓰기도 같은 프로젝트의 people/태그 존재를 검증해야 한다.

예상 총액은 `가격 × 지정 명단의 태그 인원`이다. 가격 null은 **가격 미정**, 가격 0은 0원으로 구분한다. 연결이 없으면 수량을 추측하지 않는다.

### 탈퇴·지출 보존·정산 보류 (r001-f2)

ACC-15 탈퇴 처리에서 해당 구성원의 할 일 담당은 사용자 삭제 전에 같은 트랜잭션에서 `assignee_kind = unassigned`, `assignee_id = null`로 함께 바꾼다. `member`일 때만 assignee_id가 필수이고 나머지는 null이라는 제약을 유지한다. 결제자·의견 작성자는 `on delete set null`, 분담 비율 행은 삭제한다. 사용자 삭제로 실제 지출 행·금액을 삭제하지 않는다. 작성자 등 다른 사용자 참조도 탈퇴를 막거나 공유 데이터를 연쇄 삭제하지 않도록 기존 공유 일정의 null 표시 원칙을 따른다.

실제액을 새로 입력할 때 결제일·현재 구성원 결제자는 필수다. 탈퇴로 결제자만 null이 된 기존 지출은 그대로 유지한다. 정산은 다음 중 하나 이상이면 금액 송금 안내 대신 **정산 보류**와 해당 이유를 모두 표시한다.

1. 분담 비율 없음.
2. 분담 비율 합이 100%가 아님(탈퇴로 비율 행이 지워진 경우 포함).
3. 결제한 지출에 공동/개인 미정이 있음.
4. 결제한 공동 지출의 결제자가 없음(탈퇴).

분담 비율은 구성원별 %이며 합은 100이어야 한다. 복지카드 칸·별도 정산 방식은 추가하지 않고 이전 시 메모로 보존한다. 예약 paid_amount는 total_amount 이하다.

### 사진과 계산

사진은 기존 집사 첨부와 같이 브라우저에서 줄여 Supabase Storage 가정 경로에 올린다. 메타데이터·원본·썸네일 조회/쓰기는 요청자 가정 권한으로 제한한다. `project_photos` 행 삭제 트리거에서 원본 `storage_path`와 썸네일 `thumb_path`의 두 경로를 모두 `private.agent_file_deletions` 방식 파일 삭제 큐에 넣는다. 항목 직접 삭제뿐 아니라 목록·프로젝트·가정 연쇄 삭제에도 같은 트리거를 적용한다. PJ0에서는 버킷을 만들거나 외부 파일을 올리지 않는다.

진행률·다가오는 마감·예산 합계/상한 대비·월별·정산·후보 예상 총액·태그 집계·예약 겹침은 저장하지 않는다. 계획대로 `entities/project/model/*.utils.ts` 순수 함수와 테스트로 일반화한다. wedd의 settlement·conflicts·contactDoneTags·giftEstimate 의미를 이식하되 예약 겹침은 같은 프로젝트·같은 종류만 비교하고 취소는 제외한다. 고정 날짜·고정 구성원·복지카드 규칙을 옮기지 않는다.

### source_ref와 이전 (r001-f3)

이전 대상 테이블에 nullable `source_ref`(예: `wedd:records/<id>`)와 `(family_id, source_ref)` 유일 제약을 둔다. 수동 생성은 null이고 이전 SQL은 `on conflict do nothing`으로 재실행 중복을 막는다. PJ7은 최종 스냅샷의 각 원본 id를 대상 테이블과 안정적으로 매핑한다.

최종 내보내기 직전 두 사람의 wedd 쓰기 중지 시각을 기록한다. JSON에는 id·version·updatedAt을 포함하며 개인정보·키는 git 밖 로컬에 보관한다. 적용 전 주간 백업 존재를 확인한다. 생성 SQL 전체는 한 트랜잭션으로 감싸고 해당 이전 source_ref 행만 대상으로 한 되돌리기 SQL을 함께 만든다. 최종 스냅샷의 종류별 개수·제목·날짜·예상/실제/결제액 합계·상태·링크·태그를 전부 대조하고 불일치 시 wedd를 종료하지 않는다. 원격 적용·쓰기 차단 배포·서비스 종료는 사용자가 수행한다.

## 대안과 결과

- 종류별 고정 필드·두 구성원 고정 열: 범용 프로젝트 요구와 맞지 않는다. 목록별 columns/values와 별도 구성원 의견을 쓴다.
- 단일 JSON 문서: 가정·프로젝트 간 연결, 탈퇴 보존, 정산·연결 해제 제약을 강제하기 어렵다. 관계형 테이블과 제한된 JSON 칸을 함께 쓴다.
- 일정을 복제만 하기: 삭제 후 연결 상태를 설명할 수 없다. event_id로 실제 공유 일정과 연결한다.

PJ0에서 ADR 승인과 화면 승인은 아직 필요하다. 승인 후에도 실제 SQL·RPC·RLS·Storage 구현과 검증은 PJ2~PJ5의 별도 작업이다.

## 2026-11-26 변경: 후보 받을 사람·투표·의견 반응 (사용자 결정 g205)

통합 시안(docs/design/prototype/projects-v2/) 컨펌에 따라 아래를 추가한다. 모두 `family_id` 를 두고 `current_family_id()` RLS 로 조회를 제한하며, 쓰기는 요청자 가정을 쓰는 security definer RPC 로만 한다.

- **후보 받을 사람**: 후보마다 수량 기준 명단의 사람을 지정한다(같은 후보 목록 안에서 한 사람은 후보 하나만 받는다). 후보의 예상 총액은 `가격 × 받을 사람 수`로 바뀐다. 수량 기준 명단·태그는 받을 사람을 고를 수 있는 범위로 남는다. 아직 어느 후보에도 지정되지 않은 사람은 화면 요약에 경고로 보인다. 명단 사람이나 명단이 지워지면 지정만 해제한다.
- **후보 투표**: 구성원마다 후보에 👍/👎 하나(취소 가능). 현재 가정 구성원 모두 👍 이면 '선택', 모두 👎 이면 '제외'로 보인다. 상세 시트의 [선택][제외]로 직접 정한 상태가 있으면 그것이 우선한다(되돌리면 투표 기준). 탈퇴한 구성원의 투표는 지운다.
- **결정 의견 반응**: 구성원이 다른 구성원의 의견에 👍/👎 하나를 남긴다(자기 의견에는 남기지 않음). 의견을 지우거나 작성자·반응자가 탈퇴하면 반응도 지운다.
- 정산·`project_shares`·지출 공동/개인/미정(`cost_type`)은 g193·g203 으로 만들지 않는다.
