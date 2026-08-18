# Eternal City (for-garden)

세로형 모바일 수집형 RPG. 멸종한 DNA를 되살린 호문쿨루스 소녀 **RELIC**들이 사는
"이터널 시티"에 유일한 연구원(주인공)이 입주하며 그들을 관리해 나가는 이야기.

소녀전선 스타일의 코어 컨텐츠, 니케 스타일의 세로형 화면, 림버스 컴퍼니 같은 인디 감성을
목표로 한다. 1인 개발로 감당 가능한 범위를 우선한다.

## 현재 상태

환경 토대만 갖춘 단계다. 타이틀 화면 → (탭) → 연구소 자리표시자, 두 씬만 존재한다.
전투/수집/운영 컨텐츠는 아직 없다.

## 기술 스택

- Phaser 3 + TypeScript + Vite
- 기준 해상도 1080×1920 (9:16), `Phaser.Scale.FIT`으로 축소·중앙 정렬
  - 데스크톱의 넓은 창: 좌우 레터박스로 세로 화면이 그대로 축소되어 보인다 (컴퓨터 테스트용)
  - 모바일 기기가 실제로 가로로 눕혀졌을 때만 회전 안내 오버레이가 뜬다
    (`pointer: coarse` + `orientation: landscape` 조합으로 감지, `src/style.css`)
- [PuppetForge (WebGLE)](https://github.com/Bell7080/WebGLE)를 `puppetforge` 패키지로
  git 의존성 설치 — 이후 캐릭터 스탠딩/전투용 종이인형 애니메이션을 여기서 가져다 쓴다.
  설치 시 `prepare` 스크립트가 자동으로 `dist-lib`를 빌드하므로 별도 설정이 필요 없다.

## 스크립트

```bash
npm install       # puppetforge git 의존성도 함께 빌드된다
npm run dev        # 로컬 개발 서버 (컴퓨터 브라우저로 세로 화면 확인)
npm run build      # tsc --noEmit + vite build
npm test           # Vitest (코어 로직)
npm run typecheck
npm run test:e2e   # Playwright — 모바일 화면비/터치로 빌드 결과 구동 확인 (build 이후 실행)
```

## GitHub Actions로 구동 확인

실제 모바일 기기 없이도 `.github/workflows/ci.yml`이 매 push/PR마다:

1. 타입체크 → Vitest → 빌드
2. iPhone 14 / Pixel 7 화면비로 Playwright가 빌드 결과를 실제로 띄워
   - 캔버스가 세로로 렌더링되는지
   - 탭(터치) 입력으로 타이틀 → 연구소 씬 전환이 되는지
   - 기기를 가로로 눕히면 회전 안내가 뜨는지
   를 확인하고 스크린샷을 아티팩트로 남긴다.

로컬에 모바일 기기가 없다면 Actions 실행 결과의 `mobile-screenshots` 아티팩트로
실제 화면을 확인하면 된다.

## 배포 (Vercel)

배포는 이 CI가 아니라 **Vercel의 GitHub 연동**이 맡는다. `vercel.json`에 빌드 설정을
미리 넣어뒀지만, Vercel 쪽 저장소 연결(Import)은 계정 인증이 필요해 아래 절차를
Vercel 대시보드에서 직접 한 번 해야 한다.

1. https://vercel.com/new 에서 GitHub 계정으로 로그인 → `Bell7080/For-Garden` Import
2. Framework Preset은 Vite로 자동 인식됨 (`vercel.json`이 있으면 그대로 따른다)
3. 이후로는 `main`에 push할 때마다 Vercel이 자체적으로 빌드·배포한다 (PR에는 미리보기
   배포 URL이 자동으로 달린다) — 이 저장소의 GitHub Actions와는 완전히 별개로 동작하므로,
   Playwright e2e처럼 느린 잡 때문에 배포가 지연되지 않는다.

CI(`ci.yml`)는 타입체크·테스트 품질 게이트로만 남겨뒀다. GitHub Pages 배포 잡은 제거했다.

## 구조

```text
src/
  config/     # 기준 해상도 등 상수
  core/       # 엔진 독립 순수 로직 (Vitest 대상)
  scenes/     # Phaser 씬
  debug.ts    # E2E 테스트가 씬 전환을 확인하기 위한 window 훅
tests/
  unit/       # Vitest
  e2e/        # Playwright (모바일 화면비)
```

## 다음 단계

- Google Play 출시 우선, 여지에 따라 iOS도 고려. 웹 빌드가 안정되면 Capacitor 등으로
  네이티브 래핑을 검토한다 (지금은 과설계하지 않고 웹 토대만).
- 캐릭터 30종, 스탠딩 일러스트 + 전투/운영용 SD 일러스트 분리 예정.
- 코어 전투/운영 루프는 1인 개발 범위에 맞춰 다음 단계에서 설계한다.
