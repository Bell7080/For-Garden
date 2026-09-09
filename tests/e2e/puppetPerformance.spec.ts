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
  // 로비 전신 + 정보창 전신 + 모션을 되찾은 상세 SD까지 세 Puppet이 생성된다.
  await page.waitForFunction(() => window.__PF_DEBUG?.infoOpen && window.__PUPPET_PERF__!.counts.alive >= 3);
  const firstOpen = await sampleFrames(page);

  await page.evaluate(() => window.__PUPPET_PERF__!.openGallery());
  await page.waitForTimeout(150);
  // 갤러리는 같은 전신을 옮기고 SD runtime은 멈춰 숨기므로 개체 수가 늘어나지 않는다.
  expect(await page.evaluate(() => window.__PUPPET_PERF__!.counts.alive)).toBe(3);
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
  await page.waitForFunction(() => window.__PUPPET_PERF__!.counts.alive === 3);
  const counts = await page.evaluate(() => ({ ...window.__PUPPET_PERF__!.counts }));
  console.info("Puppet frame metrics", { firstOpen, closed, switching, counts });
  await testInfo.attach("puppet-frame-metrics.json", { body: JSON.stringify({ firstOpen, closed, switching, counts }, null, 2), contentType: "application/json" });
  // 로비 1 + 정보창 전신 1 + 상세 SD 1만 살아 있고, 렐릭 교체는 이전 runtime을 남기지 않는다.
  expect(counts.alive).toBe(3);
  expect(counts.updateSubscriptions).toBe(counts.alive);
  expect(counts.created - counts.destroyed).toBe(counts.alive);
});

test("일반 Image·여러 Puppet·Graphics/Text가 교차해도 WebGL 프레임을 유지한다", async ({ page }, testInfo) => {
  // 로비 배경/Image와 Graphics/Text HUD 사이에 전신 Puppet을 두고, 정보창의 전신·SD를 더해
  // 한 프레임에 세 Puppet이 일반 Phaser 개체와 실제로 섞이는 인게임 렌더 순서를 만든다.
  await startAfterOpening(page);
  await page.goto("/?puppetPerf=1");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
  await tap(page, 540, 960);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.evaluate(() => window.__PUPPET_PERF__!.openInfo());
  await page.waitForFunction(() => window.__PF_DEBUG?.infoOpen && window.__PUPPET_PERF__!.counts.alive >= 3);

  // PNG 스크린샷은 WebGL framebuffer를 실제로 읽는다. 파일 크기와 연속 프레임 차이를
  // 함께 검사해, 뒤의 Image/Text가 사라진 단색 프레임과 Puppet 정지/누락을 모두 잡는다.
  const first = await page.screenshot({ type: "png" });
  await page.waitForTimeout(250);
  const second = await page.screenshot({ type: "png" });
  expect(first.byteLength).toBeGreaterThan(100_000);
  expect(second.equals(first)).toBe(false);
  await testInfo.attach("puppet-phaser-interleaved.png", { body: second, contentType: "image/png" });
});
