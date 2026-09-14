import { chromium, type FullConfig } from "@playwright/test";
import { currentBuildCommit } from "./buildIdentity";

/** 모든 스펙보다 먼저 한 번만 실행해, Playwright가 기대한 checkout의 번들을 보고 있음을 보장한다. */
export default async function verifyPreviewBuild(_config: FullConfig): Promise<void> {
  // CI 컨테이너가 지정한 Chromium도 실제 스펙과 동일하게 사용한다.
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
  const page = await browser.newPage();
  try {
    await page.goto("http://localhost:4173", { waitUntil: "domcontentloaded" });
    const actualCommit = await page.waitForFunction(() => window.__PF_DEBUG?.build.commit).then((handle) => handle.jsonValue());
    const expectedCommit = currentBuildCommit();
    if (actualCommit !== expectedCommit) {
      throw new Error(`E2E preview build mismatch: expected ${expectedCommit}, received ${actualCommit}`);
    }
  } finally {
    // 검증 전용 브라우저가 실제 스펙의 리소스를 빼앗지 않도록 반드시 닫는다.
    await browser.close();
  }
}
