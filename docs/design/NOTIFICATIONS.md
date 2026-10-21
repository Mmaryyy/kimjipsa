# 알림 시트 체크리스트 (P5a)

프로토타입에 없는 화면이며 기존 Sheet(Dialog), GroupLabel, ListRow를 사용한다.

- `notifications-main`: 시트 본문, 로딩·빈 값·오류 상태
- `notifications-header`: 제목 알림, 모두 읽음 버튼
- `notifications-read-all`: 모두 읽음
- `notifications-group`: 오늘·어제·M월 d일 날짜 그룹
- `notification-row`: 안 읽음 점, 변경 문구, KST 시각, 읽음 후 일정 이동
- `home-notifications`: 홈 머리 종 버튼, 안 읽은 알림 개수

375·320·1280px, 라이트·다크에서 확인한다. 설정의 `set-notify`, `s-push`,
`s-morning-time`과 일정 폼의 `f-remind`, 삭제 확인 문구는 기존 프로토타입에 대조한다.

확인 기록(2026-10-21): 기존 CDP 브라우저와 localhost:3000 목업으로
320·375·1280px 라이트·다크를 촬영해 프로토타입 알림 설정·일정 폼과 대조했다.
가로 넘침·브라우저 실행 오류가 없고, 알림 목록 로딩·빈 값·오류·재시도,
읽음 후 상세 이동·삭제된 일정 이동 방지, 설정의 새로고침 후 유지도 확인했다.
캡처는 `/private/tmp/kimjipsa-p5a/`에 있다. 실제 푸시 발송은 P5b 범위다.

수정 확인 항목(r094): `/?notifications=open` 직접 진입, 종 버튼에서 URL push, 뒤로 가기·ESC·배경·닫기(X)로 닫기, 포커스 가두기와 종 버튼 복귀. `/notifications`는 홈 시트 주소로 이동한다. 모바일은 화면 높이 대부분, 데스크톱은 가운데 시트다. 최근 30개만 표시하고 안 읽은 수는 전체를 센다.

r093/r094 수정 확인(2026-10-21): 기존 CDP 브라우저·localhost:3000 목업에서 375·1280px 설정을 프로토타입과 대조했다. 승인된 d058 순서와 공용 시각 입력을 확인했다. 알림 시트의 로딩·빈 값·오류, URL 직접 진입·리다이렉트, X·ESC·배경·뒤로 가기 닫기, 포커스 가두기·종 버튼 복귀, 읽음 후 일정 상세 이동, 시각 blur 저장·새로고침 유지도 확인했다. 캡처는 `/private/tmp/kimjipsa-p5a-fixes/`에 있다. DB 권한 통합 테스트는 실행 승인이 필요하다.
