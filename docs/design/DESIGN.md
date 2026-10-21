# 김집사 디자인 시스템 v1

신혼부부가 일정·재고·장바구니를 함께 관리하는 모바일 우선 PWA **김집사**의 디자인 규칙입니다.
기준 문서: `docs/기획서.html`, `docs/기능명세.html` (v0.11). 요구사항 ID(`CAL`·`INV`·`CART`·`BOT`·`ACC`)를 그대로 참조합니다.

- 토큰: [`css/tokens.css`](css/tokens.css)
- 공용 컴포넌트·앱 셸: [`css/app.css`](css/app.css), [`js/app.js`](js/app.js)
- 시각 카탈로그: [`components.html`](components.html)

---

## 1. 원칙

1. **Apple 기본 앱처럼 미니멀하게.** 미리 알림·설정·캘린더 앱의 plain 리스트 문법을 따릅니다. 구조는 글자 위계와 여백으로 잡습니다. **구분선(divider)은 쓰지 않습니다.** 영역 차이는 섹션 간 40px·그룹 라벨 위 24px 여백, 굵기·색 위계, 필요할 때만 옅은 면 톤(`--fill-quaternary`, `--bg-grouped-secondary`)으로 만듭니다.
2. **카드와 둥근 컨테이너는 쓰지 않습니다.** 목록·섹션·시트의 모서리는 0, 버튼·입력창은 4px입니다. 원형은 iOS 기본 컨트롤(스위치, 체크 원, 상태 점, 날짜 선택 원, 집사 아이콘)에만 씁니다.
3. **색은 의미가 있을 때만 씁니다.** 화면 대부분은 라벨·배경 뉴트럴이고, 색은 상태와 하나의 주 액션(Blue)에만 씁니다.
4. **색만으로 뜻을 전하지 않습니다.** 상태는 항상 `점 + 색 글자`, 카테고리는 `색 점 + 이름`으로 씁니다.
5. **설명 문장보다 화면 상태로 보여 줍니다.** 폼 오류는 라벨 색과 왼쪽 빨간 선으로 표시하고, 꼭 필요한 정책 안내(초대 링크 만료, 개인 일정 공개 범위 등)만 짧은 footnote로 남깁니다.

## 2. 컬러 — Apple 시스템 컬러

iOS UIKit 다이내믹 컬러 값을 그대로 씁니다. 라이트·다크 두 벌이 있고, 기본은 OS 설정(`prefers-color-scheme`)을 따릅니다. 설정 › 화면 › 모드에서 `html[data-theme]`로 강제할 수 있습니다.

> 값은 Apple HIG의 iOS 13~18 다이내믹 컬러 기준입니다. Apple이 OS 업데이트에서 일부 값을 조정하기도 하므로, 배포 전에 최신 HIG의 Color 페이지와 한 번 대조해 주세요.

### 2.1 시스템 컬러

| 이름   | 토큰           | Light     | Dark      | 대비 강화 Light / Dark |
| ------ | -------------- | --------- | --------- | ---------------------- |
| Red    | `--sys-red`    | `#FF3B30` | `#FF453A` | `#D70015` / `#FF6961`  |
| Orange | `--sys-orange` | `#FF9500` | `#FF9F0A` | `#C93400` / `#FFB340`  |
| Yellow | `--sys-yellow` | `#FFCC00` | `#FFD60A` | `#B25000` / `#FFD426`  |
| Green  | `--sys-green`  | `#34C759` | `#30D158` | `#248A3D` / `#30DB5B`  |
| Mint   | `--sys-mint`   | `#00C7BE` | `#63E6E2` | `#0C817B` / `#66D4CF`  |
| Teal   | `--sys-teal`   | `#30B0C7` | `#40CBE0` | `#008299` / `#5DE6FF`  |
| Cyan   | `--sys-cyan`   | `#32ADE6` | `#64D2FF` | `#0071A4` / `#70D7FF`  |
| Blue   | `--sys-blue`   | `#007AFF` | `#0A84FF` | `#0040DD` / `#409CFF`  |
| Indigo | `--sys-indigo` | `#5856D6` | `#5E5CE6` | `#3634A3` / `#7D7AFF`  |
| Purple | `--sys-purple` | `#AF52DE` | `#BF5AF2` | `#8944AB` / `#DA8FFF`  |
| Pink   | `--sys-pink`   | `#FF2D55` | `#FF375F` | `#D30F45` / `#FF6482`  |
| Brown  | `--sys-brown`  | `#A2845E` | `#AC8E68` | `#7F6545` / `#B59469`  |

**대비 강화(`-ic`) 값은 글자에 씁니다.** 예를 들어 Yellow `#FFCC00`는 흰 바탕 위 글자로 읽히지 않으므로, 상태 글자는 `--sys-yellow-ic`, 점·스위치 같은 채우기는 `--sys-yellow`를 씁니다.

### 2.2 시스템 그레이

| 토큰          | Light     | Dark      |
| ------------- | --------- | --------- |
| `--sys-gray`  | `#8E8E93` | `#8E8E93` |
| `--sys-gray2` | `#AEAEB2` | `#636366` |
| `--sys-gray3` | `#C7C7CC` | `#48484A` |
| `--sys-gray4` | `#D1D1D6` | `#3A3A3C` |
| `--sys-gray5` | `#E5E5EA` | `#2C2C2E` |
| `--sys-gray6` | `#F2F2F7` | `#1C1C1E` |

### 2.3 시맨틱 컬러

| 역할                 | 토큰                     | Light                   | Dark                    |
| -------------------- | ------------------------ | ----------------------- | ----------------------- |
| Label                | `--label`                | `#1D1D1F` ※             | `#E5E5EA` ※             |
| Secondary Label      | `--label-secondary`      | `rgba(60,60,67,.60)`    | `rgba(235,235,245,.60)` |
| Tertiary Label       | `--label-tertiary`       | `rgba(60,60,67,.30)`    | `rgba(235,235,245,.30)` |
| Quaternary Label     | `--label-quaternary`     | `rgba(60,60,67,.18)`    | `rgba(235,235,245,.16)` |
| System Background    | `--bg`                   | `#F6F6F8` ※             | `#1A1A1C` ※             |
| Secondary Background | `--bg-secondary`         | `#EDEDF0` ※             | `#222225` ※             |
| Tertiary Background  | `--bg-tertiary`          | `#FBFBFC` ※             | `#2C2C2F` ※             |
| Grouped Background   | `--bg-grouped`           | `#EDEDF0` ※             | `#1A1A1C` ※             |
| Secondary Grouped    | `--bg-grouped-secondary` | `#F6F6F8` ※             | `#222225` ※             |
| Tertiary Grouped     | `--bg-grouped-tertiary`  | `#EDEDF0` ※             | `#2C2C2F` ※             |
| Fill                 | `--fill`                 | `rgba(120,120,128,.20)` | `rgba(120,120,128,.36)` |
| Secondary Fill       | `--fill-secondary`       | `rgba(120,120,128,.16)` | `rgba(120,120,128,.32)` |
| Tertiary Fill        | `--fill-tertiary`        | `rgba(118,118,128,.12)` | `rgba(118,118,128,.24)` |
| Quaternary Fill      | `--fill-quaternary`      | `rgba(116,116,128,.08)` | `rgba(116,116,128,.18)` |
| Separator            | `--separator`            | `rgba(60,60,67,.29)`    | `rgba(84,84,88,.60)`    |
| Opaque Separator     | `--separator-opaque`     | `#C6C6C8`               | `#3A3A3D` ※             |
| Link                 | `--link`                 | `#007AFF`               | `#0984FF`               |

※ 김집사 조정값. Apple 원본(라벨 `#000000`/`#FFFFFF`, 배경 `#FFFFFF`/`#000000`)은 대비가 너무 강해 눈이 피로해서, 배경은 살짝 탁하게, 라벨은 순흑·순백을 피하도록 낮췄습니다. 시스템 컬러·그레이·채우기·라벨 투명도는 Apple 값 그대로입니다.

### 2.4 상태 variant (success · info · warning · error)

개발에서 `variant` 값으로 쓰는 대표 상태 4가지입니다.

**컬러 코드 (모드 고정 원본 값)** — 구현 시 그대로 옮겨 씁니다.

| variant | Apple  | 역할      | Light                                        | Dark                                         |
| ------- | ------ | --------- | -------------------------------------------- | -------------------------------------------- |
| success | Green  | 채우기    | `--success-light` `#34C759`                  | `--success-dark` `#30D158`                   |
|         |        | 글자      | `--success-text-light` `#248A3D`             | `--success-text-dark` `#30DB5B`              |
|         |        | 배경 틴트 | `--success-soft-light` `rgba(52,199,89,.14)` | `--success-soft-dark` `rgba(48,209,88,.20)`  |
| info    | Blue   | 채우기    | `--info-light` `#007AFF`                     | `--info-dark` `#0A84FF`                      |
|         |        | 글자      | `--info-text-light` `#0040DD`                | `--info-text-dark` `#409CFF`                 |
|         |        | 배경 틴트 | `--info-soft-light` `rgba(0,122,255,.14)`    | `--info-soft-dark` `rgba(10,132,255,.20)`    |
| warning | Orange | 채우기    | `--warning-light` `#FF9500`                  | `--warning-dark` `#FF9F0A`                   |
|         |        | 글자      | `--warning-text-light` `#C93400`             | `--warning-text-dark` `#FFB340`              |
|         |        | 배경 틴트 | `--warning-soft-light` `rgba(255,149,0,.14)` | `--warning-soft-dark` `rgba(255,159,10,.20)` |
| error   | Red    | 채우기    | `--error-light` `#FF3B30`                    | `--error-dark` `#FF453A`                     |
|         |        | 글자      | `--error-text-light` `#D70015`               | `--error-text-dark` `#FF6961`                |
|         |        | 배경 틴트 | `--error-soft-light` `rgba(255,59,48,.14)`   | `--error-soft-dark` `rgba(255,69,58,.20)`    |

채우기는 Apple 시스템 컬러, 글자는 Apple '대비 강화(Increased Contrast)' 값입니다.

**모드별 시맨틱 토큰** — 화면 코드에서는 이 이름만 씁니다. 라이트·다크 블록에서 위 원본 값으로 연결됩니다.

| 토큰                        | Light                | Dark                     |
| --------------------------- | -------------------- | ------------------------ |
| `--{v}` 채우기·아이콘·점    | `--{v}-light`        | `--{v}-dark`             |
| `--{v}-text` 글자           | `--{v}-text-light`   | `--{v}-text-dark`        |
| `--{v}-soft` 배너 배경      | `--{v}-soft-light`   | `--{v}-soft-dark`        |
| `--{v}-button-bg` 버튼 배경 | `--{v}-light` (채움) | `--{v}-soft-dark` (틴트) |
| `--{v}-button-fg` 버튼 글자 | `#FFFFFF`            | `--{v}-text-dark`        |

- **다크 모드 버튼은 tinted 스타일입니다.** Apple 다크 시스템 컬러는 어두운 배경에서 보이도록 라이트보다 더 밝아서, 원색을 버튼 배경에 칠하면 눈이 부십니다. 그래서 iOS의 tinted 버튼(`UIButton.Configuration.tinted()`)처럼 20% 틴트 배경에 색 글자를 씁니다.
- 마크업에서는 `data-variant="success | info | warning | error"` 하나로 `.status`, `.banner`, `.btn`의 색이 함께 바뀝니다. 컴포넌트 안에서는 `--v`, `--v-text`, `--v-soft`, `--v-btn-bg`, `--v-btn-fg`를 읽습니다.
- 코드 예: `<Status variant="warning">부족</Status>` → `data-variant="warning"`.

### 2.5 김집사 역할 매핑

아래 도메인 상태는 2.4 variant의 별칭입니다. 유통기한 임박과 배우자 개인 일정만 4종 밖의 전용 색입니다.

| 의미                       | Apple  | 채우기 토큰         | 글자 토큰                | 쓰는 곳                      |
| -------------------------- | ------ | ------------------- | ------------------------ | ---------------------------- |
| 주 액션·링크·선택          | Blue   | `--accent`          | `--accent-text`          | 구매 완료, 추가, 오늘 날짜   |
| 없음 / 파괴적 행동 → error | Red    | `--status-none`     | `--status-none-text`     | 재고 0, 삭제·탈퇴            |
| 부족 / 주의 → warning      | Orange | `--status-low`      | `--status-low-text`      | 최소 수량 이하, 연결 끊김    |
| 유통기한 임박              | Yellow | `--status-expiring` | `--status-expiring-text` | 기본 3일 전 (가정 설정)      |
| 충분·완료 → success        | Green  | `--status-ok`       | `--status-ok-text`       | 반영됨, 키 연결됨, 스위치 켬 |
| 정보 → info                | Blue   | `--status-info`     | `--status-info-text`     | 기존 재고에 더함             |
| 배우자 개인 일정           | Gray   | `--status-private`  | `--status-private-text`  | 시간만, 테두리 점 + 자물쇠   |
| 집사                       | Indigo | `--bot`             | `--bot-text`             | 집사 아이콘, 집사 이름       |
| 축하 D-day                 | Pink   | `--celebrate`       | `--celebrate-text`       | D-7부터 강조, 당일 배너      |

**일정 카테고리 기본값 (CAL-08):** {우리집 이름} Teal · 회사 Blue · 가족 Green · 약속 Purple · 병원 Pink · 기타 Brown. 상태 색(Red·Orange·Yellow)은 카테고리에 쓰지 않습니다.

**강조색 쓰임:** Blue는 한 화면에 주 액션 하나와 선택 표시 정도만 씁니다. 상태 색은 데이터가 그 상태일 때만 나타납니다.

## 3. 타이포그래피

- 서체: **스위트(Sweet / SUITE)**, [눈누 1150](https://noonnu.cc/font_page/1150). jsDelivr에서 WOFF2로 불러옵니다. 대체 서체는 `-apple-system, Apple SD Gothic Neo, system-ui`입니다.
- 굵기는 400(본문) · 500(UI 라벨) · 600(헤드라인·버튼) · 700(타이틀) 네 가지만 씁니다.
- 크기는 Apple 텍스트 스타일을 따르고, 개발에서는 아래 **variant** 이름으로 단계를 고릅니다.
- 토큰: 단계마다 `--type-{variant}-size`, `-lh`, `-weight`, `-tracking` 4개. 클래스: `.t-{variant}`. 예: `<Text variant="caption">` → `class="t-caption"`.
- 예전 Apple 이름 클래스(`.t-large`, `.t-title1~3`, `.t-callout`, `.t-subhead`, `.t-footnote`, `.t-caption`)는 별칭으로 남아 있어 기존 화면은 그대로 동작합니다.

| variant      | 크기/행간 | 굵기 · 자간   | Apple 스타일 | 쓰는 곳                          |
| ------------ | --------- | ------------- | ------------ | -------------------------------- |
| `display`    | 34/41     | 700 · -0.01em | Large Title  | 화면 제목                        |
| `title-lg`   | 28/34     | 700 · -0.01em | Title 1      | 온보딩 질문                      |
| `title`      | 22/28     | 700 · 0       | Title 2      | 상세 시트 제목, D-day 숫자       |
| `title-sm`   | 20/25     | 700 · 0       | Title 3      | 섹션 제목                        |
| `headline`   | 17/22     | 600 · 0       | Headline     | 시트·알림 제목, 강조할 항목명    |
| `body-lg`    | 17/22     | 400 · 0       | Body         | 온보딩 안내 같은 긴 문장         |
| `body`       | 16/21     | 400 · 0       | Callout      | 리스트 제목, 입력값 — 기본 본문  |
| `body-sm`    | 15/20     | 400 · 0       | Subhead      | 보조 정보, 집사 대화 메시지      |
| `label`      | 15/20     | 600 · +0.01em | Subhead      | 버튼, 링크, 탭, 필터             |
| `caption`    | 13/18     | 400 · +0.01em | Footnote     | 메타 정보, 그룹 라벨, 상태, 배너 |
| `caption-sm` | 12/16     | 500 · +0.02em | Caption 1    | 담은 사람, 요일, 타이머          |
| `caption-xs` | 11/13     | 500 · +0.02em | Caption 2    | 배지 숫자처럼 아주 작은 표기     |

`label`은 `body-sm`과 크기가 같고 굵기만 600입니다. 컨트롤 글자에만 씁니다.

숫자(수량·시간·D-day)에는 `font-variant-numeric: tabular-nums`를 씁니다.

## 4. 모양 · 간격

| 토큰                                    | 값             | 용도                                                             |
| --------------------------------------- | -------------- | ---------------------------------------------------------------- |
| `--r-none`                              | 0              | 목록, 섹션, 시트, 배너                                           |
| `--r-control`                           | 4px            | 버튼, 입력창, 세그먼트, 스테퍼, 토스트, 알림창                   |
| `--r-round`                             | 999px          | 스위치, 체크 원, 상태 점, 카테고리 점, 날짜 선택 원, 집사 아이콘 |
| `--hit`                                 | 44px           | 최소 터치 영역 (작은 컨트롤은 `::after`로 확장)                  |
| `--ctl-h-sm` / `--ctl-h` / `--ctl-h-lg` | 28 / 34 / 42px | 버튼·텍스트 버튼·아이콘 버튼의 보이는 높이 (sm / 기본 / 블록)    |
| `--row-min`                             | 40px           | 리스트 행, 설정 행 최소 높이                                     |

간격은 4pt 단위(`--sp-1`~`--sp-10`)입니다. 화면 좌우 여백은 모바일 16px, 데스크톱 40px입니다.

**금지:** 배경을 칠한 카드, 그림자 있는 타일, 12px 이상 둥근 모서리, 왼쪽 색 테두리 강조, 배경을 칠한 알약 배지, 그라데이션.

## 5. 레이아웃 · 반응형

| 구간                          | 구조                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| < 1024px (모바일·태블릿 세로) | Large Title 머리 + 단일 컬럼 + 하단 탭 바(오늘·일정·재고·장바구니·설정). 탭 바는 본문보다 한 단계 밝은 불투명 면(`--bg-grouped-secondary`)으로 구분하고 선은 긋지 않습니다. |
| ≥ 768px                       | 시트는 화면 가운데 520px 패널로, 채팅은 오른쪽 아래 400px 패널로 뜹니다.                                                                                                    |
| ≥ 1024px (데스크톱)           | 왼쪽 248px 사이드바(plain 리스트) + 본문. 홈·일정은 `.cols` 두 컬럼(1.4 : 1)입니다.                                                                                         |

- 집사 아이콘은 오른쪽 아래에 둡니다(BOT-01). 최소화하면 모바일은 하단 탭 바의 "집사" 항목으로, 데스크톱은 사이드바 항목으로 옮겨 갑니다. 최소화 여부는 `localStorage`에 기억합니다.
- 360px에서도 가로 스크롤이 생기지 않아야 합니다. 재고 행은 380px 이하에서 보조 정보를 숨깁니다.

## 6. 컴포넌트 요약

| 컴포넌트      | 클래스                                                                 | 메모                                                          |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| Plain 리스트  | `.list > li`, `.row`                                                   | 구분선 없음, 행 패딩 9px · 최소 높이 40px · 제목 Callout 16px |
| 그룹 라벨     | `.group-label`                                                         | 날짜 묶음, 마트 코너, 보관 장소                               |
| 섹션 머리     | `.section-head`                                                        | Title 3 + 오른쪽 링크                                         |
| 상태 variant  | `.status[data-variant]`, `.banner[data-variant]`, `.btn[data-variant]` | `success · info · warning · error`                            |
| 도메인 상태   | `.status[data-tone]`                                                   | `none · low · expiring · ok · info · private · bot`           |
| 카테고리 점   | `.cat.{home,work,family,meet,clinic,etc,private}`                      |                                                               |
| 버튼          | `.btn`, `.btn.gray`, `.btn.danger`, `.btn.sm`, `.btn.block`            | 4px                                                           |
| 텍스트 버튼   | `.text-btn`, `.text-btn.danger`                                        | 시트 머리, 행 끝 액션                                         |
| 세그먼트      | `.segmented`                                                           | 월·주·일, 관리 방식                                           |
| 필터 탭       | `.filters`                                                             | 밑줄 선택 표시, 가로 스크롤                                   |
| 스위치 / 체크 | `.switch`, `.check`                                                    | iOS 기본 컨트롤 모양                                          |
| 스테퍼        | `.stepper`                                                             | 재고 +/- (INV-15)                                             |
| 입력 행       | `.field-row`, `.field-row.invalid`                                     | 설정 앱식 라벨 왼쪽 · 값 오른쪽                               |
| 시트 / 확인창 | `dialog.sheet`, `dialog.alert`, `KJ.confirm()`                         | 삭제 확인에는 대상 이름을 씁니다                              |
| 토스트        | `KJ.toast(msg, {label, onClick})`                                      | 되돌리기 액션                                                 |
| 배너          | `.banner.warn/.info/.celebrate`                                        | 연결 끊김, 초대 링크 상태                                     |
| 집사 대화     | `.chat-panel`, `.msg`, `.msg .confirm`                                 | 말풍선 없는 대화록. 판단 변경은 5분 타이머                    |

## 7. 문구

- 해요체로 짧게 씁니다. 버튼은 동사로 끝냅니다(“구매 완료”, “장바구니에 담기”, “재고에 반영”).
- 삭제 확인 제목에는 대상 이름을 씁니다: `‘치과 정기검진’ 일정을 삭제할까요?`
- 배우자 개인 일정은 화면과 챗봇 모두에서 `민호님의 개인 일정도 등록되어 있습니다.`처럼 존재만 알립니다.
- 집사 이름은 `김` + 사용자가 정한 이름입니다(예: 김데비).

## 8. 접근성

- 텍스트 대비 4.5:1 이상을 맞추기 위해 상태 글자에는 대비 강화 값을 씁니다.
- 아이콘만 있는 버튼에는 `aria-label`을 붙입니다. 핵심 행동에는 텍스트 라벨을 함께 둡니다.
- `prefers-reduced-motion`에서는 집사 말줄임표와 축하 색종이를 멈춥니다(BOT-02, CAL-16).
- 시트와 확인창은 기본 `<dialog>`를 써서 포커스 가두기와 Esc 닫기를 그대로 활용합니다.

## 9. 화면

| 파일              | 화면                                                                                             | 주요 요구사항           |
| ----------------- | ------------------------------------------------------------------------------------------------ | ----------------------- |
| `splash.html`     | 앱 실행 스플래시: 워드마크만 약 1초 → 가정에 합류했으면 홈, 아니면 시작하기 (`location.replace`) | ACC-17 (PWA 실행)       |
| `onboarding.html` | 로그인 → 약관 → 우리 집 만들기 → 초대                                                            | ACC-01~05               |
| `home.html`       | 오늘: 주간 띠, 오늘 일정, 다가오는 일정, D-day, 확인할 재고, 장바구니 요약                       | CAL-06/07/13/16, INV-13 |
| `calendar.html`   | 월·주·일 뷰, 새 일정, 상세·삭제, 배우자 개인 일정 가림                                           | CAL-01~13               |
| `inventory.html`  | 보관 장소별·카테고리별 보기, 검색, +/-, 상태 품목, 다 썼어요 → 장바구니                          | INV-01~16               |
| `cart.html`       | 코너별 묶음, 공동 체크, 자주 사는 품목, 중복 안내, 오프라인                                      | CART-01~14              |
| `restock.html`    | 재고 반영 확인, 기존 품목 병합 / 새 품목 지정, 반영 없이 닫기                                    | CART-07/08, INV-12      |
| `chat.html`       | 집사 대화: 기본 메시지·FAQ, 조회, 직접 요청, 판단 변경 확인·만료                                 | BOT-01~11               |
| `settings.html`   | 내 정보, 알림, 홈 화면, 화면, 구성원·초대, 가정, AI 집사, 기억, 계정                     | ACC-07~15, BOT-13       |

설정 섹션은 d058에 따라 개인 설정을 먼저 배치하며, 프로토타입 `settings.html`의 순서와 다르다.
