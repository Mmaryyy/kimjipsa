# 컴포넌트 네이밍과 시맨틱 UI

React 컴포넌트를 만들거나 고치고, 이름을 정할 때 읽는다. 폴더·파일 배치는 `docs/02-architecture/FSD.md`, 그 밖의 코드 스타일은 `CODING_STANDARDS.md`를 본다. 문서는 한국어로, 예시의 식별자는 영어로 쓴다.

우선순위: 프레임워크의 필수 요구사항과 HTML 접근성 표준 > 이 문서 > 외부 스타일 가이드. 외부 문서와 프로젝트 규칙이 부딪히면 이 문서와 `CODING_STANDARDS.md`를 따른다.

## 1. 컴포넌트 유형

컴포넌트는 역할에 따라 네 유형으로 나누고, 유형마다 이름 기준과 FSD 위치가 다르다.

| 유형                | 이름 기준                      | FSD 위치                                      | 예시                                        |
| ------------------- | ------------------------------ | --------------------------------------------- | ------------------------------------------- |
| UI Primitive        | 시맨틱 UI·디자인 시스템 용어   | `shared/ui`                                   | `Button`, `Switch`, `Sheet`, `EmptyState`   |
| Layout              | 구조적 역할과 책임             | `shared/ui`, `app/ui`, 두 페이지 이상이면 `widgets` | `PageHeader`, `BottomNavigation`, `AppLayout` |
| Domain              | 도메인 + 개념 + 주요 책임      | `entities/<domain>/ui`                        | `InventoryItemRow`, `EventCategoryBadge`    |
| Feature Composition | 기능 또는 업무 흐름            | `features/<feature>/ui`, `widgets`            | `EventVisibilityToggle`, `InventoryOverview` |

- 모든 컴포넌트에 도메인 접두사를 붙이지 않는다. 도메인을 모르는 UI는 도메인 이름 없이, 도메인이 붙은 컴포넌트만 비즈니스 의미와 책임으로 이름을 짓는다.
- 파일 이름은 안에 든 컴포넌트 이름을 따른다(kebab-case, `CODING_STANDARDS.md` §3). 한 파일에 여러 컴포넌트를 묶는 `controls.tsx` 같은 이름은 쓰지 않는다.

## 2. UI 컴포넌트 네이밍

범용 UI는 HTML 시맨틱과 디자인 시스템에서 통용되는 이름을 우선한다.

- 권장: `Button`, `IconButton`, `TextField`, `Checkbox`, `Select`, `Dialog`, `AlertDialog`, `Tabs`, `Accordion`, `Tooltip`, `Popover`, `Table`, `Badge`, `Avatar`, `Card`, `Breadcrumb`, `Pagination`
- 지양: `CommonButton`, `CustomButton`, `ReusableDialog`, `GenericInput`, `StyledContainer`, `DefaultCard`
- `Common`, `Custom`, `Generic`, `Reusable`처럼 실제 책임을 설명하지 않는 접두사·접미사는 쓰지 않는다. 프로젝트 안에서 뜻이 분명한 추상화라면 예외다.
- 디자인 시스템(shadcn/ui)이 제공하는 컴포넌트는 공식 이름과 API를 쓰고, 이름만 바꾼 래퍼를 만들지 않는다. 표현이 모자라면 새 컴포넌트가 아니라 `variant` 같은 prop으로 푼다(`CODING_STANDARDS.md` §2).
- 공식 이름과 다른, 의미가 있는 합성 컴포넌트는 허용한다. 예: 확인 문구와 버튼 구성이 정해진 `ConfirmDialog`. 이미 만든 `ConfirmDialog`, `FilterTabs`, `StatusBadge`, `TextButton`은 그대로 두고, 새로 만들 때는 같은 역할을 공식 이름의 prop·variant로 풀 수 있는지 먼저 본다.
- 디자인 도구·프로토타입 용어(`LargeTitle`, `Segmented`)는 이름으로 쓰지 않는다. 처음 보는 사람도 목적과 쓰임을 짐작할 수 있는 이름(`PageHeader`, `SegmentedControl`)을 쓴다.

## 3. 시맨틱 HTML과 접근성

HTML 요소는 콘텐츠의 의미와 상호작용 목적에 맞게 고른다.

| 목적             | HTML              |
| ---------------- | ----------------- |
| 주요 콘텐츠      | `main`            |
| 내비게이션       | `nav`             |
| 머리말           | `header`          |
| 바닥글           | `footer`          |
| 독립적인 콘텐츠  | `article`         |
| 주제별 영역      | `section`         |
| 보조 콘텐츠      | `aside`           |
| 사용자 동작      | `button`          |
| 페이지 이동      | `a`               |
| 입력과 제출      | `form`            |
| 목록             | `ul`, `ol`, `li`  |
| 표 형식 데이터   | `table`           |
| 펼치기·접기      | `details`, `summary` |

- 동작에는 `button`, 페이지 이동에는 `a`를 쓴다. `div`에 `onClick`을 달지 않는다.
- 제목은 문서 구조에 맞는 heading 요소를 쓴다. 목록은 목록 요소를 쓴다.
- 맞는 시맨틱 요소가 없을 때만 `div`, `span`을 쓴다. 시맨틱 요소를 스타일링 목적으로 고르지 않는다.
- `section`에는 그 영역을 설명하는 제목을 둔다. 한 페이지에 `main`이 둘 이상 생기지 않게 한다(`main`은 앱 레이아웃이 하나만 가진다).
- 앱 하단 탭 메뉴와 사이드 메뉴는 `footer`가 아니라 `nav`다. `footer`는 문서·섹션의 바닥글에만 쓴다.
- 불필요한 ARIA 속성을 붙이지 않는다. 네이티브 요소로 되는 일은 네이티브로 하고, 키보드 접근성과 브라우저 기본 동작을 유지한다.

```tsx
// 지양
<div onClick={handleSubmit}>저장</div>

// 권장
<button type="button" onClick={handleSubmit}>
  저장
</button>
```

## 4. 레이아웃 컴포넌트

레이아웃 컴포넌트는 구조적 역할과 책임으로 이름을 짓는다.

- 권장: `PageHeader`, `PageFooter`, `AppLayout`, `BottomNavigation`, `SidebarNavigation`
- 지양: `TopBox`, `LeftArea`, `RightContainer`, `BottomWrapper`, `BlueSection`
- 금지하는 것은 지금의 임의 배치나 외관을 이름에 박는 것이다(디자인이 바뀌면 이름이 거짓말이 된다). `BottomNavigation`, `Sidebar`, `Header`, `Footer`처럼 역할을 설명하는 관용 용어는 위치 단어가 들어 있어도 허용한다.
- HTML 요소 하나를 감싸려고 컴포넌트를 만들지 않는다. 재사용, 상태 캡슐화, 의미 있는 합성, 디자인 일관성 중 하나가 있을 때만 분리한다.

## 5. 도메인 컴포넌트

도메인 컴포넌트의 이름은 비즈니스 도메인, 엔티티·개념, 주요 책임, 필요하면 UI 역할로 짓는다. 가능하면 `[Domain][Concept][Responsibility]` 구조를 쓴다.

- 예시: `InventoryItemRow`, `InventoryFilterPanel`, `InventorySearchField`, `InventoryEmptyState`, `EventCategoryBadge`, `EventVisibilityToggle`, `CartItemRow`, `ChatMessageBubble`
- 불필요하게 길거나 같은 말이 겹치는 이름은 줄인다. `InventoryItemInventoryCard`가 아니라 `InventoryItemCard`.

## 6. 도메인 용어 일관성

새 이름을 짓기 전에 기존 컴포넌트·타입·데이터 모델과 `docs/01-project/GLOSSARY.md`를 확인한다. 같은 개념에는 같은 영어 단어를 쓴다.

- 가정 `family`, 일정 `event`, 재고 품목 `inventory_item`, 장바구니 항목 `cart_item`, 챗봇 `bot`·`chat`을 따른다. 재고를 `Inventory`로 쓰면 `Stock`, `Storage`, `Supplies`를 섞지 않는다.
- 실제로 다른 개념이면 구분해서 쓸 수 있다.
- 개인의 네이밍 취향보다 기존 용어의 일관성이 우선이다.

## 7. UI와 도메인 책임 분리

범용 UI는 특정 비즈니스 로직에 종속되지 않는다. 도메인 컴포넌트가 범용 UI를 조합해 의미를 입힌다.

```tsx
function InventoryItemRow({ item }: InventoryItemRowProps) {
  return (
    <ListRow
      description={item.locationName}
      trailing={<StatusBadge variant="warning">유통기한 임박</StatusBadge>}
    >
      {item.name}
    </ListRow>
  );
}
```

`ListRow`와 `StatusBadge`는 범용 UI, `InventoryItemRow`는 도메인 컴포넌트다. 각자 자기 유형의 이름 규칙을 따른다.

## 8. Props 네이밍

- 기존 HTML 속성과 디자인 시스템 API를 우선한다: `variant`, `disabled`, `open`, `onOpenChange`.
- `<Button blue big inactive />`처럼 색·크기·상태를 낱개 boolean으로 받지 않는다. `variant`와 `size` 같은 의미 있는 prop으로 받는다.
- 이벤트 핸들러 이름은 `CODING_STANDARDS.md` §3을 따른다.

## 9. 네이밍 안티패턴

다음을 이름의 기준으로 삼지 않는다: 색, 크기, 임의의 화면 위치, CSS 속성, 내부 구현 방식, 일시적인 디자인 특징.

- 지양: `BlueButton`, `LargeBox`, `FlexContainer`, `LeftPanel`, `RoundedCard`, `StyledDiv`
- 권장: `PrimaryButton`(의미 있는 variant일 때), `SidebarNavigation`, `UserProfileCard`
- 뜻이 불분명한 이름도 지양한다: `DataBox`, `InfoArea`, `CommonComponent`, `CustomComponent`, `FeatureComponent`
- 디자인 시스템이 의도적으로 정의한 시각적 `variant`와 `size`는 허용한다.

## 10. 불필요한 컴포넌트 분리 금지

JSX 줄 수를 줄이려고 별도 컴포넌트로 나누지 않는다. 컴포넌트로 나눌지는 아래를 보고 정한다.

- 독립적인 책임이 있는가
- 의미 있는 재사용이 가능한가
- 상태나 상호작용을 캡슐화하는가
- 독립적인 도메인 개념을 표현하는가
- 유지보수성이 나아지는가
- 합성 경계가 분명해지는가

가독성만을 위해 긴 삼항·조건 렌더링·`map` 콜백을 정리할 때는 변수나 파일 안의 헬퍼로 빼고(`CODING_STANDARDS.md` §8), 다른 파일에서 쓰는 컴포넌트로 만들지 않는다. 파일 안에서만 쓰는 하위 컴포넌트는 bottom-up 순서로 주 컴포넌트 위에 둔다.

## 11. 에이전트 확인 절차

아래는 코드를 읽어 점검하는 절차이고 명령 실행이 아니다. 테스트·빌드·검증 스크립트는 `AGENTS.md`의 승인 규칙을 따른다.

컴포넌트를 만들기 전:

1. 기존 컴포넌트 구조를 확인한다.
2. 같거나 비슷한 컴포넌트가 있는지 검색한다.
3. 만들 컴포넌트의 주요 책임을 정한다.
4. UI, Layout, Domain, Feature 중 유형을 정한다.
5. 기존 도메인 용어를 확인한다.
6. 이름을 고른다.
7. 시맨틱 HTML과 접근성을 정한다.

구현을 끝내기 전에 모두 맞는지 점검하고, 실패한 항목은 끝내기 전에 고친다.

- 시맨틱: 요소가 의미에 맞는가, 네이티브 HTML을 먼저 썼는가, 키보드로 쓸 수 있는가, 불필요한 ARIA가 없는가
- 네이밍: 이름만으로 주요 책임이 보이는가, 유형에 맞는 이름인가, 기존 도메인 용어와 맞는가, 불필요한 접두사·접미사가 없는가
- 구조: 분리가 필요한가, 기존 컴포넌트를 쓸 수 있는가, UI와 도메인 책임이 나뉘었는가, 프로젝트 구조와 맞는가

## 참고 자료

- React: https://react.dev/learn/your-first-component
- HTML Living Standard: https://html.spec.whatwg.org/
- MDN HTML Elements: https://developer.mozilla.org/en-US/docs/Web/HTML/Element
- WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- Google TypeScript Style Guide: https://google.github.io/styleguide/tsguide.html (참고용. 프로젝트 문서와 Next.js 필수 요구가 우선)
