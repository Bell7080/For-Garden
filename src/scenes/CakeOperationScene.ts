import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { gameApi } from "../api/FakeServer";
import { session } from "../state/session";
import { CAKE_OPERATION_TIERS, cakeOperationEnemies, cakeOperationEnemyDisplayLevel, cakeOperationRunCost, cakeOperationTierIndex, isCakeTierUnlocked, type CakeOperationTier } from "../data/cakeOperation";
import type { PlayerStateDto } from "../api/contracts";
import { findItem } from "../data/items";
import { settingsManager } from "../managers/SettingsManager";
import { openItemGuide } from "../ui/currencyGuideEntry";
import { distinctElements } from "../core/element";
import { heldSweepTickets, sweepTicketState, watchSweepTicketAd } from "./dungeonSweepTickets";
import { maxSweepCount, sweepRefusal, SWEEP_TICKET_ITEM } from "../core/dungeonShortcut";
import { combatPower } from "../core/combatPower";
import { DUNGEON_LOBBY } from "../ui/dungeonLobbyLayout";
import { DungeonLobby } from "../ui/DungeonLobby";
import { addBackButton } from "../ui/IconButton";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { addSectionTitle } from "../ui/SectionTitle";
import { PopupLayer } from "../ui/PopupLayer";
import { openRewardPopup, currencyRecordToRewardItems } from "../ui/RewardPopup";
import { TopBar } from "../ui/TopBar";
import { drawVignette } from "../ui/holo";
import { LOBBY_RETURN } from "./lobbyEntry";
import { prefetchBattlePuppets } from "../puppets/battlePrefetch";
import { relicCollection } from "../managers/RelicCollectionManager";
import { CAKE_OPERATION_ENEMY_IDS } from "../data/cakeOperation";
import { startScene } from "../ui/screenTransition";
import type { PartySceneData } from "../data/partyContent";
import { consumeSceneEntry } from "./sceneEntry";

/** 편성 화면·결과판에서 돌아올 때 고른 단계를 그대로 되살린다. */
export interface CakeOperationSceneData {
  tierId?: string;
}

/**
 * **치즈케이크 대작전** — 레이티아 다섯 자매가 한꺼번에 몰려오는 물량형 던전의 입구.
 *
 * 화면은 현상수배와 같은 입구 한 장(`DungeonLobby`)이다: 단계를 고르고, 출격하거나 몇 번 소탕할지
 * 골라 소탕한다. **출격은 곧바로 전투로 가지 않고 편성 화면을 연다** — 스토리와 같은 화면에서
 * 몰려올 얼굴을 보고 데려갈 셋을 고른 뒤, 거기서 입장이 확정된다(스테미나도 그때 나간다).
 *
 * 잠긴 단계는 **조작만 감추고 말은 하지 않는다**. 고른 단계는 설정에 남겨 다음 진입이 그 자리에서
 * 시작한다.
 */
export class CakeOperationScene extends Phaser.Scene {
  private selectedTierId = CAKE_OPERATION_TIERS[0].id;
  private sweepCount = 1;
  private adFreeMembership = false;
  private dailyAdRewards?: PlayerStateDto["dailyAdRewards"];
  private busy = false;
  private popups!: PopupLayer;
  private lobby?: DungeonLobby;

  constructor() {
    super("cakeOperation");
  }

  /** 이번 진입이 되살릴 단계. `init`에서 받아 두고 곧바로 비운다(`consumeSceneEntry`). */
  private entry: CakeOperationSceneData = {};

  init(data?: CakeOperationSceneData): void {
    this.entry = { ...(data ?? {}) };
    consumeSceneEntry(this);
  }

  create(): void {
    // 단계를 고르는 동안 전투에 설 SD를 미리 읽는다. 다섯 자매는 속성만 다른 같은 몸이지만
    // **원화는 저마다 다르므로** 다섯을 다 읽어야 한 무리가 통째로 늦게 서지 않는다.
    prefetchBattlePuppets(relicCollection.validParty, CAKE_OPERATION_ENEMY_IDS);
    setDebugScene("cakeOperation", t("cake.title"));
    this.busy = false;
    this.sweepCount = 1;
    // 돌아온 단계 → 마지막으로 고른 단계 → 마지막으로 이긴 단계의 다음 칸 순이다. 잠긴 값은 `refresh`가 고친다.
    const next = Math.min(session.cakeOperation.clearedIndex + 1, CAKE_OPERATION_TIERS.length - 1);
    const remembered = this.entry.tierId ?? settingsManager.get().game.dungeonTiers.cake;
    this.selectedTierId = cakeOperationTierIndex(remembered) >= 0 ? remembered : CAKE_OPERATION_TIERS[Math.max(0, next)].id;

    addSceneBackground(this, BACKGROUND.sortieCake);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { strength: 0.72 });
    new TopBar(this, 40, { profile: false });
    addSectionTitle(this, DUNGEON_LOBBY.title.x, DUNGEON_LOBBY.title.y, t("cake.title"));
    this.popups = new PopupLayer(this, 2200);
    this.lobby = new DungeonLobby(this, {
      onSelectTier: (id) => { if (!this.busy) { this.selectedTierId = id; settingsManager.rememberDungeonTier("cake", id); this.refresh(); } },
      onSweepCount: (count) => { if (!this.busy) { this.sweepCount = count; this.refresh(); } },
      onSortie: () => this.openParty(),
      onSweep: () => void this.sweep(),
      onWatchAd: () => void this.watchAd(),
      onTicketInfo: () => { const item = findItem(SWEEP_TICKET_ITEM); if (item) openItemGuide({ scene: this, popups: this.popups }, item); },
    });
    this.refresh();
    addBackButton(this, () => this.scene.start("lobby", LOBBY_RETURN.sortie));

    // 멤버십 여부와 광고 횟수는 서버 시각으로만 정해진다 — 기기 시계를 돌려 소탕권을 건너뛸 수 없다.
    void gameApi.getPlayerState().then((state) => {
      if (!this.scene.isActive()) return;
      this.adFreeMembership = state.adFreeMembership;
      this.dailyAdRewards = state.dailyAdRewards;
      this.refresh();
    }).catch(() => undefined);
  }

  private selectedTier(): CakeOperationTier {
    return CAKE_OPERATION_TIERS[cakeOperationTierIndex(this.selectedTierId)];
  }

  /** 고른 단계·소탕 횟수·해금 상태를 한 번에 화면에 반영한다. */
  private refresh(): void {
    const clearedIndex = session.cakeOperation.clearedIndex;
    // 기억한 단계가 아직 잠겨 있으면(저장을 되돌린 경우 등) 열린 가장 높은 단계로 내려온다.
    if (!isCakeTierUnlocked(this.selectedTierId, clearedIndex)) this.selectedTierId = CAKE_OPERATION_TIERS[Math.min(clearedIndex + 1, CAKE_OPERATION_TIERS.length - 1)].id;
    const tier = this.selectedTier();
    const cost = cakeOperationRunCost(tier);
    const tickets = sweepTicketState(this.adFreeMembership, this.dailyAdRewards);
    const maxSweep = maxSweepCount({ stamina: session.wallet.stamina, tickets: heldSweepTickets(), adFreeMembership: this.adFreeMembership, cost });
    this.sweepCount = Math.min(Math.max(1, this.sweepCount), Math.max(1, maxSweep));
    const refusal = sweepRefusal({
      cleared: cakeOperationTierIndex(tier.id) <= clearedIndex, count: this.sweepCount, adFreeMembership: this.adFreeMembership,
      tickets: heldSweepTickets(), stamina: session.wallet.stamina, cost,
    });
    const sweepStamina = cost.staminaCost * this.sweepCount;
    this.lobby?.render({
      tiers: CAKE_OPERATION_TIERS.map((entry) => {
        const enemies = cakeOperationEnemies(entry);
        return {
          id: entry.id, name: entry.name, level: cakeOperationEnemyDisplayLevel(entry).level,
          elements: distinctElements(enemies.map((def) => def.element)),
          reward: { icon: "currency-cheesecake", amount: entry.rewardCheesecake },
          enemyPower: enemies.reduce((sum, def) => sum + combatPower(def.stats), 0),
          unlocked: isCakeTierUnlocked(entry.id, clearedIndex),
        };
      }),
      selectedId: tier.id,
      sortieCost: cost.staminaCost,
      sortieAffordable: session.wallet.stamina >= cost.staminaCost,
      sortieEnabled: !this.busy && session.wallet.stamina >= cost.staminaCost,
      sweepCount: this.sweepCount,
      maxSweep,
      sweepCost: sweepStamina,
      sweepAffordable: session.wallet.stamina >= sweepStamina,
      sweepEnabled: !this.busy && refusal === null,
      tickets,
    });
  }

  /** 출격은 편성 화면을 연다. 입장(스테미나 차감)은 거기서 전투 시작을 누를 때 확정된다. */
  private openParty(): void {
    if (this.busy) return;
    startScene(this, "party", { content: "cake", tierId: this.selectedTierId } satisfies PartySceneData);
  }

  /** 소탕. 차감과 지급이 서버에서 한 처리로 끝나고 화면은 영수증만 연다. */
  private async sweep(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.refresh();
    const tier = this.selectedTier();
    const requestId = `cake-sweep:${tier.id}:${this.sweepCount}:${Date.now()}`;
    try {
      const result = await gameApi.sweepCakeOperation({ tierId: tier.id, count: this.sweepCount, requestId });
      if (!this.scene.isActive()) return;
      openRewardPopup(this, this.popups, { title: t("dungeon.sweep.title"), items: currencyRecordToRewardItems(result.granted) });
    } catch {
      // 지급이 서지 않았으므로 알릴 것이 없다 — 조작만 되돌린다.
    } finally {
      this.busy = false;
      if (this.scene.isActive()) this.refresh();
    }
  }

  /** 광고를 보고 소탕권을 채운다. 취소되면 아무 일도 없다. */
  private async watchAd(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.refresh();
    try {
      const daily = await watchSweepTicketAd();
      if (daily) this.dailyAdRewards = daily;
    } catch {
      // 지급이 서지 않았다 — 가방과 횟수는 그대로다.
    } finally {
      this.busy = false;
      if (this.scene.isActive()) this.refresh();
    }
  }
}
