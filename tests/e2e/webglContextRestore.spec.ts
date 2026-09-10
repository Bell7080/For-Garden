import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { canvasBox, gamePoint, tap } from "./canvasInput";

/**
 * 모바일에서 앱을 백그라운드로 보냈다 돌아오면 WebGL 컨텍스트가 날아가는 것이 정상 동작이다.
 * Phaser는 제가 감싼 자원만 되살리고, `IndexedPuppetCreature`가 raw `gl`로 만든 program·buffer는
 * 손대지 않는다. **복구 뒤에도 `renderer.gl`은 같은 객체**라 캐시가 죽은 program을 계속 돌려주고,
 * 그대로 두면 돌아온 화면에서 캐릭터만 통째로 사라진다(실제로 그랬다).
 *
 * 화면 픽셀 대신 **죽은 program을 쓴 횟수**를 세는 이유는, 그것이 이 버그의 정의 그 자체라
 * 원화가 바뀌어도 흔들리지 않기 때문이다.
 */
test("컨텍스트를 잃었다 되찾아도 죽은 GL program으로 그리지 않는다", async ({ page }) => {
  // Phaser가 컨텍스트를 만들기 전에 걸어야 한다.
  await page.addInitScript(() => {
    const proto = WebGLRenderingContext.prototype as unknown as { useProgram: (p: WebGLProgram | null) => void };
    const original = proto.useProgram;
    (window as unknown as { __deadProgramUses: number }).__deadProgramUses = 0;
    proto.useProgram = function (this: WebGLRenderingContext, program: WebGLProgram | null): void {
      // 죽은 컨텍스트의 손잡이는 isProgram이 false이고, 쓰면 INVALID_OPERATION이 난다.
      if (program && !this.isProgram(program)) (window as unknown as { __deadProgramUses: number }).__deadProgramUses += 1;
      return original.call(this, program);
    };
  });

  await startAfterOpening(page);
  const box = await canvasBox(page);
  const center = gamePoint(box, 540, 960);
  await tap(page, center.x, center.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 애착 렐릭 Puppet이 실제로 설 때까지 기다린다. 서 있지 않으면 잃을 것도 없어 검사가 헛돈다.
  await page.waitForTimeout(4000);

  const restored = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;
    const gl = canvas.getContext("webgl") as WebGLRenderingContext;
    const ext = gl.getExtension("WEBGL_lose_context");
    if (!ext) return false;
    const back = new Promise<void>((r) => canvas.addEventListener("webglcontextrestored", () => r(), { once: true }));
    ext.loseContext();
    await new Promise((r) => setTimeout(r, 300));
    ext.restoreContext();
    await Promise.race([back, new Promise((r) => setTimeout(r, 4000))]);
    // 복구 이전의 실패는 세지 않는다. 우리가 보는 것은 "돌아온 뒤에도 죽은 것을 쓰는가"다.
    (window as unknown as { __deadProgramUses: number }).__deadProgramUses = 0;
    return true;
  });
  expect(restored).toBe(true);

  // 복구 뒤 여러 프레임을 그리게 둔다.
  await page.waitForTimeout(4000);
  const deadUses = await page.evaluate(() => (window as unknown as { __deadProgramUses: number }).__deadProgramUses);
  expect(deadUses).toBe(0);
});
