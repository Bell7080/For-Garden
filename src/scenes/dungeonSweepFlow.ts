import type Phaser from "phaser";
import type { DungeonSweepResponse, PlayerStateDto } from "../api/contracts";
import type { DungeonRunCost } from "../core/dungeonShortcut";
import { t } from "../i18n";
import { relicCollection } from "../managers/RelicCollectionManager";
import { session } from "../state/session";
import type { PopupLayer } from "../ui/PopupLayer";
import { currencyRecordToRewardItems, openRewardPopup } from "../ui/RewardPopup";
import { openSweepPopup } from "../ui/SweepPopup";
import { playSweepSkirmish } from "../ui/SweepSkirmish";
import { sweepTicketState, watchSweepTicketAd } from "./dungeonSweepTickets";

/** 소탕 연출은 팝업 층 바로 위에 선다 — 영수증은 연출이 걷힌 뒤에 열린다. */
const SKIRMISH_DEPTH = 2400;

export interface DungeonSweepFlow {
  scene: Phaser.Scene;
  popups: PopupLayer;
  tierName: string;
  level: number;
  cost: DungeonRunCost;
  cleared: boolean;
  /** 그 단계의 대표 적 — 연출에서 애착 렐릭과 맞선다. */
  enemyId: string;
  /** 그 콘텐츠가 싸우는 전장 원화 — 연출의 띠 안에 깔린다(`battleFieldBackground`). */
  fieldKey: string;
  membership: () => boolean;
  dailyAdRewards: () => PlayerStateDto["dailyAdRewards"] | undefined;
  setDailyAdRewards: (daily: PlayerStateDto["dailyAdRewards"]) => void;
  /** 서버 경계 — 스테미나·소탕권·지급이 한 처리로 확정된다. */
  request: (count: number) => Promise<DungeonSweepResponse>;
  /** 입구를 잠그고 푸는 자리(연출과 영수증 사이에 다른 조작이 끼어들지 않게). */
  setBusy: (busy: boolean) => void;
  /** 서버가 거절했을 때(해금을 다시 읽는 등). */
  onFailed?: () => void;
}

/**
 * 던전 입구의 소탕 한 벌 — **소탕 창 → 연출 → 영수증**. 현상수배와 치즈케이크 대작전이 같은 길을 지난다.
 *
 * 배율은 소탕 창(`openSweepPopup`)이 고르고, 누르면 서버 요청과 소탕 연출(`playSweepSkirmish`)이 **나란히**
 * 돈다 — 연출이 결과를 기다리게 하지도, 결과가 연출을 끊지도 않는다. 둘 다 끝나면 영수증이 경험치
 * 블록과 함께 열린다. 거절되면 연출을 곧바로 걷고 아무것도 알리지 않는다(지급이 서지 않았다).
 */
export function openDungeonSweep(flow: DungeonSweepFlow): void {
  const { scene, popups } = flow;
  openSweepPopup(scene, popups, {
    tierName: flow.tierName,
    level: flow.level,
    cost: flow.cost,
    cleared: flow.cleared,
    membership: flow.membership,
    tickets: () => sweepTicketState(flow.membership(), flow.dailyAdRewards()),
    onWatchAd: async () => {
      try {
        const daily = await watchSweepTicketAd();
        if (daily) flow.setDailyAdRewards(daily);
      } catch {
        // 지급이 서지 않았다 — 가방과 횟수는 그대로다.
      }
    },
    onConfirm: (count) => void run(flow, count),
  });
}

async function run(flow: DungeonSweepFlow, count: number): Promise<void> {
  const { scene, popups } = flow;
  flow.setBusy(true);
  const heroId = session.favorite && session.owned.has(session.favorite) ? session.favorite : relicCollection.validParty[0] ?? session.favorite;
  const skirmish = playSweepSkirmish(scene, { heroId, enemyId: flow.enemyId, count, fieldKey: flow.fieldKey, depth: SKIRMISH_DEPTH });
  // 응답이 오는 대로 확정된 보상을 넘긴다 — 그 뒤의 타격부터 그 아이콘이 튀어나온다.
  const request = flow.request(count).then((result) => { skirmish.setRewards(currencyRecordToRewardItems(result.granted)); return result; });
  try {
    const [result] = await Promise.all([request, skirmish.done]);
    if (!scene.scene.isActive()) return;
    openRewardPopup(scene, popups, { title: t("dungeon.sweep.title"), items: currencyRecordToRewardItems(result.granted), playerExp: result.playerExp });
  } catch {
    skirmish.close();
    flow.onFailed?.();
  } finally {
    flow.setBusy(false);
  }
}
