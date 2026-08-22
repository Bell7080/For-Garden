# 이벤트 콘텐츠 정의와 운영 경계

## 레퍼런스

정규 이벤트의 검증된 구성인 **기간 한정 스토리 → 전용 스테이지 → 목표형 임무 → 한정 교환소** 흐름을
레퍼런스로 삼았다. 특히 Arknights의 공식 이벤트 공지에서 반복되는 이벤트 스테이지·임무·상점 묶음과,
Honkai: Star Rail 공식 이벤트 공지의 기간 한정 콘텐츠 및 종료 시각 고지 방식을 구조 참고 대상으로
삼았다. 외부 사례의 명칭·수치·서사·UI를 복제하지 않고 운영 단위와 서버 종료 경계만 반영했다.

- Arknights 공식 사이트: <https://www.arknights.global/news>
- Honkai: Star Rail 공식 뉴스: <https://hsr.hoyoverse.com/en-us/news>

## 이 저장소의 원칙

- `src/data/events/`는 기간과 기존 `DialogueStory`, `StageDef`, `PRODUCTS`의 연결만 소유한다.
- 이벤트 목록의 `status`와 `serverTime`은 `GameApi.getEvents()` 응답을 신뢰한다. 화면에서
  `Date.now()`로 활성 여부를 다시 계산하지 않는다.
- 이벤트 전투는 `GameApi.enterEventStage()`로 입장 허가를 받은 뒤 기존 전투 흐름을 사용한다.
- 구매 및 전투 결과 확정 시점에도 서버가 기간을 다시 검사한다. 입장 화면을 오래 열어 둔 채 종료
  시각을 넘기는 경우까지 막기 위해서다.
- 이벤트 스토리 ID는 `RECOLLECTION_STORIES`에도 등록한다. `StoryManager.complete()`가 기록한 기존
  `completedStoryIds`를 회상 해금 여부로 그대로 사용할 수 있다.

## 첫 이벤트 범위

`사라진 날개의 발굴 보고서`는 큰바다쇠오리 한 종에 대한 짧은 보고서, 전투 한 곳, 목표 두 개,
교환 상품 한 개만 제공한다. 첫 운영에서 기간 경계와 콘텐츠 연결을 검증하기 위한 소규모 구성이다.

