import { createInitialRelicProgress } from "../../src/state/session";
import { expect, test } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame } from "./canvasInput";

test("치즈케이크 15명과 디안 소환수: 실제 로딩·사망 정지·안내 중 재소환 크기", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => {
    s.party = ["dian", "torika", "mette"];
    for (const id of s.party) { s.owned.add(id); s.relicProgress[id] = { ...createInitialRelicProgress(), level: 60, breakthrough: 4 }; }
    s.settings.game.autoUltimate = true;
    s.settings.game.battleSpeed = 2;
    s.settings.game.skipUltimatePresentation = true;
  });
  await sourceScene(page, `this.game.scene.stop('title');this.game.scene.start('battle',{mode:'cake',tierId:'cake-8'});window.__SWARM=this.game.scene.getScene('battle');`);
  await expect.poll(() => page.evaluate(() => (window as any).__SWARM.spawned), { timeout: 120000 }).toBe(true);
  const metrics = await page.evaluate(() => {
    const scene = (window as any).__SWARM;
    const enemies = [...scene.views.values()].filter((v: any) => v.fighter.side === "enemy");
    const wolf = [...scene.views.values()].find((v: any) => v.fighter.summonOwnerId);
    if (!wolf) throw new Error("디안 소환수 없음");
    const before = wolf.creature.scaleX;
    // 안내창으로 코어가 멈춰 syncViews가 다시 호출되지 않는 상황을 재현한다.
    scene.reviveView(wolf.fighter.id);
    const after = wolf.creature.scaleX;
    scene.playDeath(wolf.fighter.id);
    const frozen = wolf.creature.animationFrozen;
    const poseVersion = wolf.creature.poseVersion;
    wolf.creature.step(0, 16);
    const updatesAfterDeath = wolf.creature.poseVersion - poseVersion;
    scene.reviveView(wolf.fighter.id);
    return { enemies: enemies.length, creatures: scene.views.size, before, after, frozen, updatesAfterDeath, revivedFrozen: wolf.creature.animationFrozen };
  });
  expect(metrics.enemies).toBe(15);
  expect(metrics.after).toBeCloseTo(metrics.before, 5);
  expect(metrics.frozen).toBe(true);
  expect(metrics.updatesAfterDeath).toBe(0);
  expect(metrics.revivedFrozen).toBe(false);
  await captureGame(page, info.outputPath("cake-8-with-dian.png"));
  await info.attach("swarm-metrics", { body: JSON.stringify({ ...metrics, errors }, null, 2), contentType: "application/json" });
  expect(errors).toEqual([]);
});
