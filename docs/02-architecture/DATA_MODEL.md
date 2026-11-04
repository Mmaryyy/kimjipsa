# 데이터 모델

명세의 "데이터 항목 (제안)"과 요구사항에서 확인되는 구조만 정리한다. 원본에서 "제안"이므로 전체가 **PROPOSED**이고, 스키마 확정 전에 `DECISIONS_REQUIRED.md`의 데이터 공백을 먼저 정한다. 명세에 없는 필드·관계는 `[공백]`으로 표시하고 임의로 확정하지 않는다. 컬럼 타입은 필드 의미에서 읽히는 후보이며 마이그레이션 작성 때 확정한다.

원본 위치: 명세 각 FEATURE의 "데이터 항목 (제안)" 표와 "기본 목록" 표.

## 1. 엔티티 관계 개요

```
users 1─N memberships N─1 families
families 1─N invites
families 1─1 ai_settings
families 1─N event_categories / units / inventory_categories / locations
families 1─N events, inventory_items, cart_items
families 1─N chat_messages, families 1─N agent_runs
families 1─N family_memories, families 1─N receipt_imports
events N─1 event_categories;  events N─1 users(owner)
inventory_items N─1 units / inventory_categories / locations
cart_items N─0..1 inventory_items;  cart_items N─1 users(added_by, checked_by)
```

모든 가정 데이터에는 `family_id`가 있다고 가정한다 `[공백: 명세에 명시 없음, "가정 단위" 표현에서 도출]`. 가정 범위 격리는 RLS가 맡는다.

## 2. 가정·계정

### users
| 필드 | 설명 | 출처 |
| --- | --- | --- |
| 로그인 수단 | 카카오·구글. 수단별 별개 계정. 계정은 제공자 + 제공자 사용자 id로 구분하고 이메일은 식별에 쓰지 않음(카카오는 이메일 미수집) | ACC-01, 명세 확정 정책, ADR-0009 |
| 표시 이름 | 일정 작성자, 체크한 사람, 챗봇 "OO님"에 사용. 6자 이하 | ACC-07 |
| 약관 동의 기록 | 이용약관·개인정보 동의 시각(`terms_accepted_at`, `privacy_accepted_at`)과 동의한 약관 버전(`terms_version`). 최초 프로필 완료 시 `timestamptz` 두 필드와 `text` 버전을 저장하며 표시 이름 수정 시 유지. P2 초안 버전은 `draft-2026-10-16` | ACC-02, DEC-013 |
| 사용자별 설정 | 알림 시각(아침 요약, 기본 10시), 홈 화면 뷰(월/주/일), 위젯 on/off와 개수(3/5/10, 기본 5), 푸시 on/off | ACC-11, ACC-12, CAL-07, CAL-13 |
| 챗봇 최소화 여부 | 사용자별 기억 | BOT-01 |
| 챗봇 기억 on/off | 끄면 새 대화가 요약되어 쌓이지 않음 | BOT-13 |

DEC-009 ① 처리(2026-10-16 제안안 승인, 2026-10-21 P5a 구현): `push_subscriptions`(`user_id`, `endpoint`, `keys`, `created_at`)와 `notifications`(`user_id`, `family_id`, `kind`, `payload`, `read_at`, `created_at`)를 둔다. 개인 일정의 시작 전 알림에는 본인만 수신하는 제목·시작 시각을 허용한다(2026-10-22 사용자 결정). 배우자 변경 알림에는 개인 일정 내용을 넣지 않는다. P5a에서 `notifications`에 `id`(uuid PK)와 위 필드를 추가했다. kind는 event_created·event_updated·event_deleted이며 payload는 eventId·actorName·eventTitle(공유 일정만)·eventDeleted(삭제 후 이동 방지)다. 작성 행위자를 제외한 같은 가정 구성원에게 일정 RPC와 같은 트랜잭션에서 생성한다. 개인 일정은 일반 변경 알림을 생성하지 않고, 개인으로 전환하면 이전 알림의 eventTitle을 제거한다. 공유↔개인 전환은 event_participants_changed 알림을 생성한다(2026-10-22 사용자 결정). 공유→개인은 변경 전 공유 제목만, 개인→공유는 현재 제목을 eventTitle로 저장하고 참가 인원 변경 문구로 표시한다. 본인·현재 가정의 알림만 조회하고 read_at만 수정할 수 있으며 직접 생성은 허용하지 않는다. 푸시 구독 테이블은 P5b에서 추가한다.

사용자별 알림 설정은 기존 홈 설정과 같은 `users`의 `push_enabled`(boolean, 기본 true), `morning_summary_time`(time, 기본 10:00)에 저장한다. `save_notification_settings` RPC는 본인 설정만 갱신하며 분 단위 HH:mm만 허용한다. P5a에서는 푸시 구독이나 발송을 하지 않는다.

### families
| 필드 | 설명 | 출처 |
| --- | --- | --- |
| 가정 이름 | 첫 일정 카테고리 이름이 됨. 10자 이하 | ACC-03 |
| 챗봇 이름 | 가정에 하나. "김" 접두로 표시 | BOT-15, ACC-10 |
| 임박 기준 | 유통기한 임박 일수. 기본 3 | INV-05 |

### memberships
사용자와 가정의 연결과 역할(`admin`, `member`, `child`). MVP 화면은 `admin`만 쓴다(ACC-06). 제약: **한 사용자는 한 가정에만 속한다**(명세 확정 정책). 인원 제한 없음.

### invites
토큰, 만료 시각, 사용 여부. 제약: 1회 사용 후 무효, 생성 3일 후 만료, 한 명을 초대할 때마다 새 링크(ACC-05). 생성자(`created_by`), 수락자(`accepted_by`), 수락 시각(`accepted_at`) 필드를 둔다. 사용 여부는 `accepted_by`가 있는지로 판단한다. 명세에는 없는 필드이고 DEC-009 ⑤에서 사용자가 정했다.

### ai_settings (챗봇 명세와 같은 항목)
가정 단위. 집사 이름·기억 사용 여부·설정 및 기억 버전·문맥 초기화 시각을 관리한다. 모델·인증은 맥미니 Hermes에서 관리한다(2026-11-04 사용자 변경, ADR-0017). 최초 마이그레이션의 provider/model/encrypted_key/key_suffix 컬럼은 호환을 위해 남기되 후속 `20261104010000_local_gateway_model.sql`의 RPC에서는 사용·반환하지 않는다.

## 3. 일정

### event_categories
가정 단위. 이름과 색. 기본값: {가정 이름}, 회사, 가족, 약속, 병원, 기타. 추가·수정·삭제 가능(CAL-08). 소속 일정 처리는 DEC-009 ⑥(삭제하면 `기타`로 이동, `기타`는 삭제 불가). 표시 순서는 `sort_order`로 저장하고 사용자가 바꿀 수 있다(2026-10-16 사용자 결정). 기본 순서는 {가정 이름}이 맨 앞, 나머지는 이름순.

### events (시간 정보, ADR-0012)
가정 구성원이 모두 읽는다. 개인 일정도 이 행은 보이고 희미한 칸으로만 표시한다.

| 필드 | 설명 | 제약 |
| --- | --- | --- |
| `start_date`, `end_date` | 시작일·종료일(Asia/Seoul 기준 날짜) | 시작일 필수. 기간 일정은 종료일이 시작일보다 뒤 |
| `start_time`, `end_time` | 시작·종료 시각 | **각각 선택**(2026-10-16 사용자 결정). 둘 다 비우면 "시간 미정". 같은 날이고 둘 다 있으면 종료가 시작보다 뒤. 종일이면 둘 다 비움 |
| `is_all_day` | 종일 여부 | 종일은 "하루 종일"이고 시간 미정과 다름 |
| `visibility` | `shared` / `private` | 기본 `shared` |
| `owner_id` | 작성자 | private일 때 열람·수정 권한 기준. 공유→개인 전환은 작성자만 가능(2026-10-16 사용자 결정). 탈퇴 시 공유 일정은 null |
| `kind` | `event` / `dday` | |
| `recurrence` | `daily` / `weekly` / `monthly` / `yearly` | null은 반복 없음. 일반 일정만 허용 |
| `recurrence_until` | 마지막 회차의 원래 날짜(포함) | null은 종료 없음. 반복 일정이면 시작일 이후 |
| `external_id` | 구글 캘린더 연동용 | 쓰지 않음(CAL-15 범위 제외, 2026-10-30) |

### event_details (내용, ADR-0012)
`events`와 1:1. 읽기는 "공유 일정이거나 작성자 본인"만 허용한다.

| 필드 | 설명 | 제약 |
| --- | --- | --- |
| `title`, `place`, `memo` | 제목 필수, 장소·메모 선택 | 개인 일정이면 배우자에게 비공개 |
| `category_id` | 카테고리 | 카테고리가 일정 성격을 드러낼 수 있어 내용 쪽에 둠 |
| `remind_before` | 시작 전 알림(분) | 기본 30, 기존 일정도 30분 전으로 채움. null은 없음, 허용 값 10·30·60·1440 |
| `dday_style` | `normal` / `celebrate` | `dday`일 때만 사용 |
| `celebrate_message` | 축하 문구 | 선택. 비어 있으면 기본 문구(DEC-009 ②) |

### event_exceptions (회차 시간·취소, ADR-0012)
같은 가정의 모든 구성원이 읽을 수 있다. 쓰기는 `save_event`·`delete_event` RPC만 허용한다.

| 필드 | 설명 | 제약 |
| --- | --- | --- |
| `event_id`, `original_date` | 시리즈와 원래 회차 날짜 | 복합 기본 키, 일정 삭제 시 함께 삭제 |
| `family_id` | 가정 | 일정과 같은 가정만 연결 |
| `cancelled` | 해당 회차 취소 여부 | 기본 false |
| `start_date`, `end_date` | 변경한 시작일·종료일 | 종료일은 시작일 이후 또는 같은 날 |
| `start_time`, `end_time`, `is_all_day` | 변경한 시각·종일 여부 | events와 같은 시간 검증 |

### event_exception_details (회차 내용, ADR-0012)
`event_exceptions`와 1:1. 읽기는 같은 가정에서 **공유 일정이거나 작성자 본인**만 허용한다. 개인 예외의 제목·장소·메모·카테고리·알림은 배우자에게 비공개다. 쓰기는 RPC만 허용한다.

| 필드 | 설명 | 제약 |
| --- | --- | --- |
| `event_id`, `original_date`, `family_id` | 회차와 가정 | 앞 두 필드가 기본 키. 예외 삭제·시리즈 이동 시 함께 반영 |
| `title`, `place`, `memo` | 변경한 제목·장소·메모 | 제목 필수, 장소·메모 기본 빈 문자열 |
| `category_id` | 변경한 카테고리 | 같은 가정만 연결 |
| `remind_before` | 변경한 알림 시점 | null 또는 10·30·60·1440분 |

‘이후 모든 일정’ 저장은 선택한 회차의 예외를 삭제한다(첫 회차에서 전체 수정할 때도 동일). 이후 예외는 원래 날짜에 보존하고, 분할하면 새 시리즈로 이동한다. 새 반복 규칙에 맞는 날짜의 예외만 표시된다. 날짜를 옮긴 회차에서 저장하면 폼의 시작일이 새 규칙의 기준일이 된다.

시간 미정 일정은 달력의 그날 칸 맨 아래에 시각 없이 표시한다(종일 일정과 별개). 종일·시간 미정 일정의 시작 전 알림은 그날 00:00을 기준으로 한다(2026-10-21 사용자 결정). P5a는 저장만 하고 발송은 P5b에서 구현한다.

파생(저장 안 함): D-day 남은 일수, N주년(등록 연도 기준, 등록한 해는 표시 안 함).

DEC-009 처리(2026-10-16, 제안안 승인, 필요하면 차후 수정): ② 축하 카드 닫음 상태는 `dday_card_dismissals`(`user_id`, `event_id`, `year`)로 저장한다. ④ 탈퇴자가 만든 공유 일정은 `owner_id`를 null로 두고 "탈퇴한 사용자"로 표시한다. ⑥ 일정 카테고리를 지우면 소속 일정은 `기타` 카테고리로 옮기고 `기타`는 삭제할 수 없다. 반복 일정은 일정 하나에 반복 규칙(`recurrence`, 매일·매주·매월·매년)을 두고, "이 일정만" 수정·삭제는 해당 회차의 예외 행으로 저장한다. "이후 모든 일정"은 기존 규칙을 그 회차 전에서 끝내고 새 일정(규칙)으로 나눈다(2026-10-30 사용자 결정, 권장안). **개인 일정 컬럼 보호 구조는 ADR-0012로 확정(DEC-001).**

## 4. 재고

### inventory_items
| 필드 | 설명 | 제약 |
| --- | --- | --- |
| `name` | 품목 이름 | 필수 |
| `mode` | `quantity` / `status` | 기본 `quantity` |
| `quantity`, `unit_id` | 수량 품목에서 사용. 단위는 가정 단위 목록에서 선택 | 수량 0은 유효. 음수 불가(P6 입력·DB 제약) |
| `status` | `enough` / `low` / `none` | 상태 품목에서 사용 |
| `min_quantity` | 수량 품목의 부족 기준 | 선택 |
| `category_id`, `location_id` | 가정 단위 카테고리·보관 장소 | |
| `expires_on` | 유통기한 | 선택 |

파생(저장 안 함): 부족/없음(INV-03), 임박(INV-05).

P6 구현: `families.expiry_days`(0~30 정수, 기본 3), `inventory_items`에 `id`·`family_id`를 둔다. 품목과 목록의 복합 FK로 다른 가정의 목록 연결을 차단한다. `write_inventory` RPC가 저장·삭제·수량 증감·상태 부분 변경·다 썼어요·수량 병합을, `write_inventory_meta` RPC가 목록 변경·초기화·임박 기준 변경을 처리한다. 두 RPC는 요청자의 가정을 사용하고 가정별 잠금을 공유한다. 조회만 RLS로 허용하고 직접 쓰기는 RPC로 제한한다.

### units / inventory_categories / locations (가정 단위 목록)
- DEC-014(P6): 재고 카테고리는 `icon_kind`(`lucide`/`text`/null)·`icon_value`를 저장한다. 사용자 문자는 보이는 한 글자로 서버와 화면에서 같은 공용 검증을 쓰며 색은 저장하지 않는다. 보관 장소는 `enabled`, 각 목록은 `sort_order`를 둔다. 목록 되돌리기는 같은 이름의 기본 항목 ID를 유지한다. 직접 추가한 카테고리의 품목만 `기타`로 옮기며, 장소 연결은 모두 유지하고 숨긴 장소를 다시 표시한다. 직접 추가한 장소도 품목 연결을 위해 유지한다. 사용 중인 단위는 초기화해도 유지한다.
- 단위 기본: 개, 팩, 병, 봉지, 캔, 박스, 롤, g, kg, ml, L. 사용 중인 단위는 삭제 차단(INV-06).
- 카테고리 기본: 채소·과일, 정육·수산, 유제품·계란, 가공식품, 음료, 양념·소스, 생활용품, 건강·뷰티, 기타. 장바구니 마트 코너 기준으로도 재사용(CART-04).
- 보관 장소 기본: 냉장실, 냉동실, 실온 식품장·팬트리, 욕실·세탁실, 서랍·수납장. 필드: "사용 안 함" 여부. 숨겨도 품목은 유지(INV-08).
- DEC-009 처리(2026-10-16, 제안안): ⑦ 가정 생성 시 서버 함수가 기본값을 복사해 채운다. ③ 카테고리 정렬 순서는 가정 단위 카테고리 목록의 `sort_order` 필드로 저장한다(장바구니 마트 코너 순서와 공유). ⑥ 재고 카테고리를 지우면 소속 품목을 `기타`로 옮긴다. `기타`는 삭제할 수 없다(2026-10-24 사용자 승인). 장바구니 품목도 같은 카테고리 삭제·초기화 시 `기타`로 옮긴다(P7).

## 5. 장바구니

### cart_items
| 필드 | 설명 | 제약 |
| --- | --- | --- |
| `name`, `quantity`, `unit_id` | 이름, 수량, 단위(재고와 같은 목록) | |
| `category_id`, `memo` | 카테고리(재고와 같은 목록), 메모 | 선택 |
| `link_url` | 외부 쇼핑몰 링크 | 선택, 새 탭으로 열림 |
| `added_by`, `checked_by` | 추가한 사람, 체크한 사람 | |
| `is_checked` | 장보는 중 체크 여부 | |
| `inventory_item_id` | 재고 품목과 연결되면 값 | 구매 반영 때 사용 |
| `purchased_at` | 구매 완료 시각 | 값이 있으면 **구매 기록**(목록에서는 제외) |

구매 기록은 별도 테이블이 아니라 `purchased_at`이 있는 항목으로 둔다(명세 표 기준). 자주 사는 품목은 이 기록에서 계산한다(CART-05).

## 6. 챗봇

| 엔티티 | 설명 | 제약 |
| --- | --- | --- |
| `conversations` | 사람별 대화와 메시지 | 본인만 접근(BOT-11). 마지막 메시지 후 1시간 만료·삭제(BOT-14) |
| `memories` | 사람별 요약 기억 항목 | 사용자가 수정·삭제 가능. 선호·습관만 저장, 민감 정보·배우자 개인 일정 제외 |
| `pending_actions` | 챗봇이 판단해 제안한 변경 요청 | 확인 전에는 데이터 불변, 5분 뒤 만료(BOT-08) |
| `ai_settings` | §2 참조 | |
| `bot_faq` | 기본 메시지에 쓰는 FAQ와 저장된 답변 | AI를 거치지 않음. 첫 구성은 보류 |

`[공백]` 대화 종료(5분 무활동) 판정과 요약 시점의 상태 저장(DEC-004), `pending_actions` 내용 형식(액션 종류·대상 id·변경값), 여러 건 묶음의 항목별 선택 상태는 명세에 없음.

## 7. 데이터 생성·변경 흐름

| 흐름 | 생성·변경되는 데이터 | 요구사항 |
| --- | --- | --- |
| 온보딩 | `users` → `families` + `memberships(admin)` → 기본 카테고리·단위·장소 시드 → `invites` | ACC-01~05 |
| 합류 | 초대 토큰 검증(미사용·미만료·무소속자) → `memberships(admin)` → 토큰 무효화 | ACC-04, ACC-05 |
| 일정 저장 | `events` 저장 → (공유면) 배우자 알림 | CAL-01, CAL-09 |
| "다 썼어요" | `inventory_items` 수량 0/상태 none → (선택) `cart_items` 추가 | INV-04, CART-06 |
| 구매 완료 | 체크한 `cart_items` → 확인 화면 → 재고 병합/신규 → `purchased_at` 기록 | CART-07~09, INV-12 |
| 직접 요청 | 도구가 해당 entity 직접 변경 → 결과 안내 | BOT-07 |
| 챗봇 판단 | `pending_actions` 생성 → 확인 시 변경, 5분 후 만료 | BOT-08 |
| 대화 종료 | `memories` 갱신 | BOT-12 |
| 탈퇴 | 본인 private `events`, `conversations`, `memories` 삭제. 공유 데이터 유지(작성자 FK는 null). 안 쓴 `invitations` 삭제, 쓴 초대는 `created_by`·`accepted_by` null. 관리자가 남지 않으면 권한을 넘긴 뒤에만 탈퇴, 마지막 구성원이면 가정 삭제 | ACC-15 |

### P5b 푸시·예약 알림 (2026-10-21)

`push_subscriptions`는 위 확정 필드로 구현하며 endpoint가 기본 키이고 본인만 조회·등록·갱신·삭제한다. API는 브라우저 푸시 서비스의 HTTPS 주소와 키 형식을 검사한다. 다른 사용자가 소유한 endpoint를 덮어쓸 수 없다.

알림 kind에 `event_reminder`·`morning_summary`를 추가한다. 시작 전 payload는 eventId·date·eventTitle·startTime(시각 또는 종일·시간 미정), 아침 요약은 date·eventIds·times·count다. 시작 전 알림은 제목과 시작 시각을 보여 주며 장소·메모는 담지 않는다. 목록과 푸시에서 시각순 요약을 표시한다. 개인 일정은 본인만 예약 대상으로 계산하고 RPC에서도 수신 권한을 재확인한다. 앱 내 알림은 푸시 설정과 무관하게 생성한다.

`private.notification_schedule_log`(dedupe_key PK, notification_id unique FK, created_at)는 예약 중복을, `private.notification_push_log`(notification_id FK, endpoint, created_at, PK(notification_id, endpoint))는 푸시 중복을 막는다. 두 기록은 일반 사용자에게 노출하지 않는다. `notification_worker`는 Vault cron_secret을 검사하는 서버 작업 전용 RPC다. 성공한 기기의 선점은 유지하고, 404·410은 구독을 삭제한다. 그 밖의 오류·타임아웃은 실패한 주소의 선점만 해제해 5분 보충 창 안에서 다시 시도한다(ADR-0013).

웹 푸시 on/off(`users.push_enabled`)는 계정 단위이며 모든 구독 기기에 함께 적용한다. 기기 구독 여부와 계정 설정은 별개다. 로그아웃 시 해당 기기의 구독만 삭제·해지하고 계정 설정은 유지한다.

P6 입력 제한(2026-10-24): 품목 이름 100자, 목록 이름 30자, 임박 기준 0~30일. 앱 검증과 SQL 함수·CHECK에 같은 범위를 적용한다.

## 2026-11-04 가족 집사 연동

가족 공용 집사는 [ADR-0017](ADR/0017-local-family-agent.md)과 `supabase/migrations/20261104000000_family_agent.sql`을 따른다. private.ai_settings·private.agent_actions·private.agent_file_deletions, public.agent_workers·chat_messages·agent_runs·chat_attachments·receipt_imports·family_memories를 추가한다. 기존 users → 개인 대화·기억 관계는 families → 공용 대화·기억 관계로 대체한다. 가정 자체가 공용 대화 ID이며 별도 family_agents 테이블은 만들지 않는다.


### 일정·장보기 도구와 개인 채팅 확장

`20261104020000_agent_capabilities.sql`은 `chat_messages.visibility(shared/private)`, 개인 열람자 `viewer_id`, 검색 출처 `sources`와 `chat_attachments.visibility`를 추가한다. 기존 대화는 shared로 유지한다. 개인 메시지는 viewer만 읽으며 연결된 실행·영수증·제안·사진도 같은 권한으로 제한한다. 개인 대화는 가족 기억 요약에서 제외하고 계정 삭제 시 함께 삭제한다.

`20261104040000_hermes_shared_read.sql`은 워커의 가정에 묶인 읽기 전용 `agent_read` RPC를 추가한다. 새 데이터 열·테이블은 없다. Hermes 자체 기억은 로컬 프로필에 별도로 저장하고 앱의 Supabase 기억 관리와 분리한다(ADR-0018).

`agent_proposals`는 run별 하나의 변경 목록·상태·버전·5분 만료·적용 결과를 저장한다. 제안은 선택 항목만 원자적으로 실행하고 재확인은 같은 결과를 반환한다. 실제 변경과 `private.agent_actions` 기록, 실행 완료는 같은 트랜잭션이다. 대상의 스냅샷 리비전이 바뀌면 실행하지 않는다. 일정·재고·장바구니 쓰기는 기존 `save_event`·`write_inventory`·`write_cart`를 사용한다. 가정 채널에는 내용과 개인 메시지 ID 없이 변경 신호만 보낸다.

2026-11-04 사용자 요청(BOT-01/11): `20261104030000_chat_pagination.sql`의 `chat_page`는 요청자의 가정·공개 범위를 적용한 최신 50개와 `before` 이전 50개를 조회한다. `sequence` 기준 커서를 사용하며 응답 메시지는 시간순이다. 다음 커서 `nextBefore`가 null이면 끝이다. 연결된 작업·영수증·제안·사진만 함께 반환하고, 공유/개인 조회용 인덱스를 둔다. 기존 대화와 보관 기간은 바뀌지 않는다.

### 개인 대화 만료 (2026-11-04 사용자 변경, BOT-11/14)

앱 대화는 `visibility=private`, `viewer_id=auth.uid()`로 고정한다. `private.chat_sessions`의 가정·사용자별 버전은 만료 삭제 때 증가한다. 마지막 사용자·집사 메시지부터 1시간이 지나면 조회·전송·확인 또는 기존 5분 정리 작업에서 메시지와 연결된 실행·영수증·제안을 삭제한다. 첨부 메타데이터 삭제 트리거는 기존 파일 삭제 큐를 사용한다. 동일 가정 잠금으로 삭제와 워커 완료를 직렬화한다. 이전 페이지 응답은 버전이 다르면 합치지 않는다. 가족 기억과 Hermes 기억은 삭제 대상이 아니다. 기존 공용 기록은 앱에서 제공하지 않으며 기존 보존 정책을 유지한다.
