import { defineConfig, devices } from "@playwright/test";

/**
 * 실제 모바일 기기가 없어도 GitHub Actions에서 화면비/터치 구동을 확인하기 위한 설정.
 * 빌드된 결과물을 `vite preview`로 띄운 뒤 세로형 기기 프로필로 접속한다.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  /**
   * **한 번에 한 편만 돈다.**
   *
   * 이 게임은 매 프레임 WebGL로 전장을 다시 그리고, 스펙은 "몇 초 안에 이 상태가 되는가"를
   * 폴링으로 잰다. 브라우저 넷이 한 기계에서 동시에 돌면 프레임이 굶어 그 시간 안에 상태가
   * 도달하지 못하고, 실제로 멀쩡한 화면이 무더기로 `Timeout ... waiting on the predicate`로
   * 실패한다 — 4코어에서 병렬로 돌렸을 때 31편이 그렇게 죽었고, 같은 커밋을 한 편씩 돌리자
   * 3편만 남았다. 느려지는 대신 **실패가 실패를 뜻하게** 한다.
   */
  workers: 1,
  /**
   * 캐릭터 묶음(zip)이 수 MB라 첫 화면까지 시간이 걸리고, 실시간 전투 검증은 전투가 실제로
   * 끝날 때까지 기다린다. GPU 없이 도는 환경에서는 타이틀 로딩부터 전투 진입까지만 1분 반이
   * 들고, 캡처 한 장이 다시 10초를 더 쓴다 — 그래서 전투를 거치는 편은 2분 안에 들어오지
   * 못한다. 게다가 배속은 프레임이 드물면 코어의 한 프레임 진행 상한에 걸려 실제로 빨라지지
   * 않으므로, 전투를 끝까지 보는 편은 3배속을 걸어도 1배속만큼 걸린다고 봐야 한다. 한도는
   * 여기 한 곳만 두고 편마다 `setTimeout`으로 다시 적지 않는다.
   */
  timeout: 240_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { outputFolder: "playwright-report", open: "never" }]] : "list",
  use: {
    // 컨테이너·CI처럼 브라우저가 이미 깔린 환경은 그 실행 파일을 그대로 쓴다. 없으면 예전처럼
    // Playwright가 제 캐시에서 찾는다 — 개발자 기계의 동작은 바뀌지 않는다.
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
    baseURL: "http://localhost:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // 실제 iOS는 WebKit이지만, CI에는 Chromium만 설치한다. 화면비·터치 구동 확인이 목적이므로
  // iPhone 14 기기 프로필의 뷰포트/터치 설정만 가져와 Chromium 위에서 그대로 재현한다.
  projects: [
    {
      name: "iphone-14",
      use: { ...devices["Desktop Chrome"], ...devices["iPhone 14"], defaultBrowserType: "chromium" },
    },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
  ],
});
