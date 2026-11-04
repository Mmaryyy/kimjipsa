# 0019. AI Elements 대화 화면

Status: CONFIRMED (2026-11-04 사용자 승인)

## 결정

- Vercel AI Elements의 Chat 예시를 기준으로 Conversation, Message, PromptInput을 사용한다. 대기는 현재 shadcn Spinner에 해당하는 Loader로 표시한다. FAQ는 기존 TextButton을 재사용하며 쓰지 않는 Suggestion은 제거한다.
- 공식 레지스트리 소스에서 쓰지 않는 다운로드·메시지 분기·마크다운·모델 선택·별도 첨부 상태를 제외한 뒤 shadcn CLI로 `src/shared/ui/ai-elements/`에 설치한다. 기존 Button·Textarea와 업로드·재시도 상태를 재사용하고 `shared/ui` public API로 내보낸다.
- 추가 런타임 의존성은 `use-stick-to-bottom` 1.1.6이다. `ai`의 타입 참조는 로컬 role 타입으로 대체한다. Streamdown·nanoid·cmdk 등 사용하지 않는 기능의 의존성은 추가하지 않는다.
- Conversation의 스크롤 요소와 기존 스크롤 훅을 연결한다. 이전 대화를 앞에 붙일 때 위치 복원·자동 불러오기·새 메시지 따라가기의 단일 책임은 기존 훅에 둔다. 스크롤은 즉시 이동해 동작 줄이기를 존중한다.
- 색·모서리·글꼴은 김집사 토큰을 사용한다. 집사 아바타 배경은 HANDOFF의 하늘색을 `--bot-avatar-bg`에 둔다. 대화는 개인 대화 하나로 제공하며 마지막 메시지 후 1시간 만료와 세션 번호를 따른다. API·DB 계약과 5분 확인 만료 규칙은 유지한다.

- 2026-11-04 사용자 결정: 전용 페이지 대신 AppLayout의 `widgets/chat-panel`에서 모바일 전체 화면·데스크톱 우하단 패널로 연다. 기존 Sheet의 Radix Dialog를 재사용해 접근성과 스크롤 잠금을 유지한다. `/chat`은 홈으로 replace한 뒤 여는 호환 진입점으로 남긴다.
- 인사와 기능 목록은 대화 맨 앞의 화면 전용 집사 메시지다. FAQ는 시안의 링크 색 TextButton이며 클릭한 질문·답은 로컬 목록에만 추가한다.

## 근거

[AI Elements Chat 예시](https://elements.ai-sdk.dev/examples/chatbot). AI Elements는 2026년 11월 말 shadcn/ui로 이전 예정이며 설치한 소스는 저장소에서 관리한다. 모델 호출 계층은 기존 Hermes이고 AI SDK를 도입하지 않는다.
