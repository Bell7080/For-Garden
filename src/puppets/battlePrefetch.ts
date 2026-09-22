import type Phaser from "phaser";
import { preloadPuppetAssets, type PuppetAsset } from "./assets";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";

/** 중복을 없앤 전투 묶음 목록. 같은 개체가 양쪽에 서도 한 번만 읽는다. */
function battleAssets(allyRelicIds: readonly string[], enemyRelicIds: readonly string[]): PuppetAsset[] {
  const assets = new Map<string, PuppetAsset>();
  const add = (relicId: string, side: "ally" | "enemy"): void => {
    const asset = relicAppearanceManager.battleAssetFor(relicId, side);
    if (!assets.has(asset.url)) assets.set(asset.url, asset);
  };
  for (const relicId of allyRelicIds) add(relicId, "ally");
  for (const relicId of enemyRelicIds) add(relicId, "enemy");
  return [...assets.values()];
}

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
 *
 * 이 길은 **곧 들어갈 사람**의 것이라 한꺼번에 던져 일꾼 넷을 다 쓴다. 로비처럼 아직
 * 들어갈지 모르는 자리는 아래 `prefetchIdlePuppets`를 쓴다.
 */
export function prefetchBattlePuppets(allyRelicIds: readonly string[], enemyRelicIds: readonly string[] = []): void {
  const assets = battleAssets(allyRelicIds, enemyRelicIds);
  if (assets.length === 0) return;
  void preloadPuppetAssets(assets).catch(() => undefined);
}

/**
 * 로비에서 **손이 노는 동안** 다음 전투의 SD를 한 장씩 읽어 둔다.
 *
 * 로비는 캐릭터를 보는 화면이라 대개 한참 머무는데, 그 시간이 통째로 버려지고 있었다 —
 * 출격을 누른 뒤에야 읽기 시작하니 편성과 진입의 대기가 거기서부터 시작한다. 여기서 미리
 * 읽어 두면 그 뒤의 길은 이미 캐시를 집는다.
 *
 * **읽을 것은 현재 편성뿐이고, 보유 렐릭 전부로 넓히지 않는다.** 일꾼은 디코드까지 끝낸
 * `ImageBitmap`을 돌려주고 그 그림은 **처음 세워질 때까지** 메모리에 남는다
 * (`IndexedPuppetCreature`의 `decodedTextures` → `ensureTexture`가 올리며 지운다). 그래서
 * 미리 읽고 **쓰지 않은** 묶음은 한 장에 6.5MB씩 그대로 붙잡힌다 — 열아홉을 다 읽으면
 * 120MB가 아무도 보지 않는 그림으로 남는다. 거주 규칙(`core/puppetResidency.ts`)이 관리하는
 * 것은 GPU에 올라간 뒤이고 이쪽은 그 앞단이라, 여기서는 **읽는 양 자체를 좁혀서** 막는다.
 * 편성 셋이면 20MB 남짓이고, 그것이 정확히 다음 전투가 쓸 몫이다.
 *
 * **한 장씩 읽는다.** 일꾼이 넷인데 한꺼번에 던지면 그동안 로비가 여는 정보창·도감 카드가
 * 줄 뒤에 서서, 미리 읽기가 지금 보는 화면을 느리게 만든다. 하나씩 읽으면 셋은 늘 비어 있다.
 *
 * 로비를 떠나면 남은 것은 읽지 않는다 — 다음 화면이 제 몫을 읽어야 하는데 그 앞에 끼어들면
 * 같은 줄 서기가 된다.
 */
export function prefetchIdlePuppets(scene: Phaser.Scene, allyRelicIds: readonly string[]): void {
  const assets = battleAssets(allyRelicIds, []);
  if (assets.length === 0) return;

  let left = false;
  scene.events.once("shutdown", () => { left = true; });
  void (async () => {
    for (const asset of assets) {
      if (left) return;
      // 한 장이 끝나야 다음을 던진다. 실패는 조용히 넘어간다 — 쓸 때 제 경로가 다시 읽는다.
      await preloadPuppetAssets([asset]).catch(() => undefined);
    }
  })();
}
