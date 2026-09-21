import { preloadPuppetAssets, type PuppetAsset } from "./assets";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";

/**
 * 전투에 설 SD를 **들어가기 전에** 읽어 둔다.
 *
 * 누가 나갈지는 편성을 고르는 순간 이미 정해지는데, 예전에는 전투 씬에 **들어간 뒤에야**
 * 읽기 시작했다 — 편성 화면을 보는 동안의 시간과 씬 전환의 한 박자를 통째로 버리고, 그
 * 대가를 진입 직후의 빈 전장으로 치렀다.
 *
 * **기다리지 않는다.** 부르는 화면은 이 함수를 `void`로 던져 두고 하던 일을 계속한다 —
 * 미리 읽기가 화면을 붙잡으면 고치려던 것과 같은 멈춤이 자리만 옮긴 셈이 된다. 실패해도
 * 조용히 넘어간다: 못 읽은 묶음은 전투가 제 경로로 다시 읽으므로 여기서 알릴 일이 없다.
 *
 * 같은 묶음을 두 번 부르는 것도 안전하다. `loadPuppet`이 URL로 **진행 중인 약속까지**
 * 캐시하므로 두 번 내려받지 않는다.
 */
export function prefetchBattlePuppets(allyRelicIds: readonly string[], enemyRelicIds: readonly string[] = []): void {
  const assets = new Map<string, PuppetAsset>();
  const add = (relicId: string, side: "ally" | "enemy"): void => {
    const asset = relicAppearanceManager.battleAssetFor(relicId, side);
    if (!assets.has(asset.url)) assets.set(asset.url, asset);
  };
  for (const relicId of allyRelicIds) add(relicId, "ally");
  for (const relicId of enemyRelicIds) add(relicId, "enemy");
  if (assets.size === 0) return;
  void preloadPuppetAssets([...assets.values()]).catch(() => undefined);
}
