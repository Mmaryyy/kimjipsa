---
name: create-component
description: 김집사의 UI 컴포넌트를 만든다. 새 컴포넌트, 공용 컴포넌트, 상태 배지, 확인 대화상자 같은 UI 작성을 요청받았을 때 사용한다. 만들기 전에 기존 컴포넌트를 먼저 찾는다.
---

# create-component

## 절차

1. **기존 컴포넌트 탐색**: 새로 만들기 전에 `shared/ui`, `entities/*/ui`, `widgets`, `features/*/ui`에서 `rg`로 같은 역할이 있는지 찾는다. 있으면 그것을 쓰고, 모자라면 원본에 범용 prop이나 CVA variant를 추가한다(기본값은 기존 외형 유지). 쓰지 못할 기술적 이유가 있을 때만 별도로 만들고 보고에 적는다. (`docs/03-guidelines/CODING_STANDARDS.md` §2)
2. **디자인 시스템 확인**: `docs/03-guidelines/DESIGN_SYSTEM.md`. 디자인 토큰이 아직 없으면 색·간격 값을 임의로 정하지 말고 사용자에게 확인한다. Figma 링크가 있으면 `figma` 스킬을 쓴다.
3. **책임 정의 / 위치 결정**: 도메인을 모르면 `shared/ui`, 도메인 표현(상태 배지, 카드)은 해당 entity의 `ui/`, 한 기능에서만 쓰면 그 slice, 두 페이지 이상이 쓰는 조합은 widget. 판단이 서지 않으면 `pages`에서 시작한다(`docs/02-architecture/FSD.md` §4).
4. **Props 및 타입 설계**: 범용 컴포넌트는 도메인을 모르고, 화면별 차이는 `size`, `appearance`, `tone`, slot 같은 범용 prop으로 받는다. 래핑 컴포넌트는 `ComponentProps<typeof X>`를 쓴다. `key`를 prop 이름으로 쓰지 않는다. `any` 금지.
5. **접근성**: 버튼/링크 역할 구분, 아이콘만 있는 핵심 행동에는 텍스트 라벨, 대화상자 포커스, 색만으로 상태를 전달하지 않기, "동작 줄이기" 존중.
6. **반응형**: 모바일 우선. 1개/여러 개, 긴 이름, 빈 목록에서 확인한다.
7. **상태별 UI**: Loading(목록 모양 skeleton), Empty/Error(공용 빈 상태 컴포넌트), 비활성/오류(폼은 필드 인라인)를 구현한다.
8. **스타일 규칙**: 시각 variant는 `*.variants.ts`(CVA), 데이터는 `*.constants.ts`. 클래스 합치기는 `cn()`. (Tailwind/CVA가 확정된 경우. 확정 전이면 사용자에게 확인)
9. **import 규칙**: 슬라이스 밖에서는 `index.ts`로만 import. 깊은 경로 import 금지.
10. **검증**: 렌더링·테스트·린트 실행은 사용자 승인 뒤에. 코드 작업을 마치면 `yarn format` → `yarn format:check`(`package.json`이 없으면 건너뛰고 보고).
11. **보고**: 만든/재사용한 컴포넌트, 위치와 이유, 새로 복사한 JSX/로직 덩어리가 없는지 점검 결과.
