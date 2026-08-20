import { defineConfig, devices } from "@playwright/test";

/**
 * 실제 모바일 기기가 없어도 GitHub Actions에서 화면비/터치 구동을 확인하기 위한 설정.
 * 빌드된 결과물을 `vite preview`로 띄운 뒤 세로형 기기 프로필로 접속한다.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  /**
   * 캐릭터 묶음(zip)이 수 MB라 첫 화면까지 시간이 걸리고, 실시간 전투 검증은 전투가 실제로
   * 끝날 때까지 기다린다. GPU 없이 도는 환경에서는 이 둘만으로 1분을 넘긴다.
   */
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { outputFolder: "playwright-report", open: "never" }]] : "list",
  use: {
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
