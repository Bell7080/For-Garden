# 다음 픽업 원화

2026-11-12 승인: 플레시오사우루스 모티브 캐릭터의 해저 달빛 피크닉 원화를 다음 픽업에 사용한다.

2026-11-13 에셋 등록 완료. WebP 디코딩과 이미지 외관을 확인했다.

- 게임용 에셋: `public/sprites/background/recruit_moon_picnic.webp`
- 배경 키: `BACKGROUND.recruitMoonPicnic`
- 선택 원본: `output/moon-picnic-pickup/moon-picnic-portrait-v2.png`
- 크기: 941 × 1672 (세로 약 9:16). 기존 배경과 같은 WebP 품질 84로 변환하며 확대하지 않는다.
- 게임용 파일 용량: 206,386 bytes (약 202 KiB).
- 제작: 내장 이미지 생성 도구. 첨부 캐릭터 디자인과 디안·화석 연구의 실제 모집 원화를 참조했다.

2026-11-12 응태: 이 원화는 플레샤 픽업 배경이다. 정식 배너가 아직 없어 QA 픽업 배너(`qa-pickup-plesha`)에 먼저 깔았다(`QA_PICKUP_ART`). 출시 일정은 미정이다. 다음 픽업 배너를 정의할 때 해당 배너의 `artKey`에
`BACKGROUND.recruitMoonPicnic`을 연결한다. 현재 디안 배너와 모집 풀은 유지한다.

2026-11-12 정식 배너: 플레샤 한정 픽업 `moonlit`(호박석 연구 · 천장 그룹 `limited-pickup-moonlit`)의 `artKey`로 옮겼다. QA 픽업 배너와 `QA_PICKUP_ART`는 걷었다.
디안 배너와 나란히 서고, 모집판 결은 `BANNER_TONE.moonlit`(달빛 크림 → 페리윙클 → 보랏빛, 별빛 노랑 강조), 로비 이벤트 카드는 「밤하늘의 피크닉」(`moon-picnic`)이다.
