import type Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { BountyBattleInputDto } from "../core/bountyRun";
import type { CakeBattleInputDto, RaidBattleInputDto } from "../core/expeditionBattle";
import type { PartyContent } from "../data/partyContent";
import { rememberPlayerExp } from "../managers/PlayerExpReceipts";
import { session } from "../state/session";
import { startScene } from "../ui/screenTransition";

/**
 * 콘텐츠 한 판의 **입장** — 편성 화면의 전투 시작과 결과판의 「다시 하기」가 함께 지난다.
 *
 * 두 곳이 저마다 입장을 부르면 한쪽만 규칙이 뒤처진다(한때 결과판에서 돌아올 때만 단계가 빠졌다).
 * 입장 비용(스테미나)은 전부 서버가 확정한 뒤에만 전장으로 넘어간다 — 화면이 먼저 넘어가면
 * 입장이 거절된 판을 싸우게 된다. 거절은 던져서 부르는 쪽이 알린다. 레이드도 입장에서
 * 스테미나와 도전 한 번을 함께 쓰고, 판이 끝난 뒤 그 입장 영수증으로 피해를 제출한다.
 *
 * 입장이 올린 연구원 경험치는 결과판이 보여 주도록 맡겨 둔다(`rememberPlayerExp`).
 */
export async function enterContentBattle(scene: Phaser.Scene, content: PartyContent): Promise<void> {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${content.content}-entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (content.content === "raid") {
    const admission = await gameApi.enterRaid({ raidId: content.raidId, requestId });
    rememberPlayerExp(admission.playerExp);
    startScene(scene, "battle", { mode: "raid", raidId: content.raidId, bossRelicId: content.bossRelicId, difficulty: content.difficulty, requestId } satisfies RaidBattleInputDto);
    return;
  }
  if (content.content === "bounty") {
    const admission = await gameApi.enterBounty({ tierId: content.tierId, requestId });
    rememberPlayerExp(admission.playerExp);
    startScene(scene, "battle", { mode: "bounty", tierId: admission.tierId, round: 0, requestId } satisfies BountyBattleInputDto);
    return;
  }
  if (content.content === "cake") {
    const admission = await gameApi.enterCakeOperation({ tierId: content.tierId, requestId });
    rememberPlayerExp(admission.playerExp);
    startScene(scene, "battle", { mode: "cake", tierId: admission.tierId, requestId } satisfies CakeBattleInputDto);
    return;
  }
  const admission = await gameApi.enterStage({ stageId: session.selectedStageId!, requestId });
  rememberPlayerExp(admission.playerExp);
  startScene(scene, "battle", { mode: "stage" });
}
