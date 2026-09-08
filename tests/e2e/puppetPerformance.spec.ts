import { expect, test, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { tap } from "./canvasInput";

interface FrameSample { averageMs: number; longFrames: number; frames: number }

/** requestAnimationFrame 간격을 재며 60fps 예산의 두 배(33.4ms)를 넘긴 프레임을 길다고 센다. */
async function sampleFrames(page: Page, durationMs = 1_500): Promise<FrameSample> {
  return page.evaluate((duration) => new Promise<FrameSample>((resolve) => {
    const deltas: number[] = [];
    let previous = performance.now();
    const started = previous;
    const frame = (now: number): void => {
      deltas.push(now - previous); previous = now;
      if (now - started < duration) { requestAnimationFrame(frame); return; }
      resolve({
        averageMs: deltas.reduce((sum, value) => sum + value, 0) / deltas.length,
        longFrames: deltas.filter((value) => value > 33.4).length,
        frames: deltas.length,
      });
    };
    requestAnimationFrame(frame);
  }), durationMs);
}

test("로비와 정보창 Puppet의 프레임 비용 및 UPDATE 수명을 기록한다", async ({ page }, testInfo) => {
  // URL 플래그는 화면/저장 데이터가 아니라 이 테스트 한 탭에서만 진단 진입점을 활성화한다.
  await startAfterOpening(page);
  await page.goto("/?puppetPerf=1");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
  await tap(page, 540, 960);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.waitForFunction(() => window.__PUPPET_PERF__?.counts.alive === 1);

  await page.evaluate(() => window.__PUPPET_PERF__!.openInfo());
  // 장식용 SD는 정지 텍스처이므로 로비 전신 + 정보창 전신 두 Puppet만 생성된다.
  await page.waitForFunction(() => window.__PF_DEBUG?.infoOpen && window.__PUPPET_PERF__!.counts.alive >= 2);
  const firstOpen = await sampleFrames(page);

  await page.evaluate(() => window.__PUPPET_PERF__!.openGallery());
  await page.waitForTimeout(150);
  // 갤러리는 같은 전신을 옮기고 정지 SD만 숨기므로 runtime 수가 늘어나지 않는다.
  expect(await page.evaluate(() => window.__PUPPET_PERF__!.counts.alive)).toBe(2);
  await page.evaluate(() => window.__PUPPET_PERF__!.closeGallery());

  await page.evaluate(() => window.__PUPPET_PERF__!.closeInfo());
  await page.waitForFunction(() => window.__PF_DEBUG?.infoOpen === false);
  const closed = await sampleFrames(page);

  await page.evaluate(() => window.__PUPPET_PERF__!.openInfo());
  const switching = await page.evaluate(async () => {
    const samples: number[] = []; let previous = performance.now(); const started = previous; let lastSwitch = previous;
    return new Promise<FrameSample>((resolve) => {
      const frame = (now: number): void => {
        samples.push(now - previous); previous = now;
        if (now - lastSwitch >= 250) { window.__PUPPET_PERF__!.nextCharacter(); lastSwitch = now; }
        if (now - started < 2_000) { requestAnimationFrame(frame); return; }
        resolve({ averageMs: samples.reduce((sum, value) => sum + value, 0) / samples.length, longFrames: samples.filter((value) => value > 33.4).length, frames: samples.length });
      };
      requestAnimationFrame(frame);
    });
  });

  // 마지막 비동기 교체가 끝나 이전 전신/SD를 파괴할 때까지 기다린 뒤 수명을 판정한다.
  await page.waitForFunction(() => window.__PUPPET_PERF__!.counts.alive === 2);
  const counts = await page.evaluate(() => ({ ...window.__PUPPET_PERF__!.counts }));
  console.info("Puppet frame metrics", { firstOpen, closed, switching, counts });
  await testInfo.attach("puppet-frame-metrics.json", { body: JSON.stringify({ firstOpen, closed, switching, counts }, null, 2), contentType: "application/json" });
  // 로비 1 + 정보창 전신 1만 살아 있다. SD는 Puppet이 아니며, 렐릭 교체도 이전 전신을 남기지 않는다.
  expect(counts.alive).toBe(2);
  expect(counts.updateSubscriptions).toBe(counts.alive);
  expect(counts.created - counts.destroyed).toBe(counts.alive);
});
