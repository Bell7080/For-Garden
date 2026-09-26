import type Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { BountyBattleInputDto } from "../core/bountyRun";
import type { CakeBattleInputDto, RaidBattleInputDto } from "../core/expeditionBattle";
import type { PartyContent } from "../data/partyContent";
import { session } from "../state/session";
import { startScene } from "../ui/screenTransition";

/**
 * 콘텐츠 한 판의 **입장** — 편성 화면의 전투 시작과 결과판의 「다시 하기」가 함께 지난다.
 *
 * 두 곳이 저마다 입장을 부르면 한쪽만 규칙이 뒤처진다(한때 결과판에서 돌아올 때만 단계가 빠졌다).
 * 입장 비용(스테미나)은 전부 서버가 확정한 뒤에만 전장으로 넘어간다 — 화면이 먼저 넘어가면
 * 입장이 거절된 판을 싸우게 된다. 거절은 던져서 부르는 쪽이 알린다. 레이드는 판이 끝난 뒤
 * 제출에서 도전 횟수를 센다.
 */
export async function enterContentBattle(scene: Phaser.Scene, content: PartyContent): Promise<void> {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${content.content}-entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (content.content === "raid") {
    startScene(scene, "battle", { mode: "raid", raidId: content.raidId, bossRelicId: content.bossRelicId, difficulty: content.difficulty } satisfies RaidBattleInputDto);
    return;
  }
  if (content.content === "bounty") {
    const admission = await gameApi.enterBounty({ tierId: content.tierId, requestId });
    startScene(scene, "battle", { mode: "bounty", tierId: admission.tierId, round: 0, requestId } satisfies BountyBattleInputDto);
    return;
  }
  if (content.content === "cake") {
    const admission = await gameApi.enterCakeOperation({ tierId: content.tierId, requestId });
    startScene(scene, "battle", { mode: "cake", tierId: admission.tierId, requestId } satisfies CakeBattleInputDto);
    return;
  }
  await gameApi.enterStage({ stageId: session.selectedStageId!, requestId });
  startScene(scene, "battle", { mode: "stage" });
}
