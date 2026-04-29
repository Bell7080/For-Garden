# For-Garden

A/D 이동 + Space 점프가 가능한 스프라이트 러너 데모입니다.

## 실행
```bash
python -m http.server 8080
```
브라우저에서 `http://localhost:8080` 접속.

## GitHub Pages (main 브랜치 /root 배포)
- `main` 브랜치의 **/root(저장소 루트)** 배포 기준으로 동작합니다.
- 루트에 `index.html`, `styles.css`, `game.js` 파일을 유지하세요.
- `char_run_001.png`는 직접 루트에 업로드하세요.

## 반영한 로직
- 무한맵처럼 좌우로 계속 달릴 수 있도록 월드 스크롤 방식 적용
- Space 점프 추가
- 프레임 순서 변경: `16 → 2 → 3 → ... → 15 → 16`
  - 요청사항대로 기존 1번 프레임은 사용하지 않고, 16번을 1번 자리로 대체
- 비율 유지 축소 렌더링으로 캐릭터 눌림 현상 완화

## 시트 규격
- 기본: 8열 x 2행
- `USE_FULL_GRID = true` : 깔끔하게 잘린 시트
- 원본처럼 라벨/여백이 큰 시트면 `USE_FULL_GRID = false`로 바꾸고 상단 수동 좌표값 조정

