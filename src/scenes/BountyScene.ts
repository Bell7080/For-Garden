import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { bountyRoundEnemy, bountyRoundLevel, BOUNTY_TIERS, getBountyTier } from "../data/bounty";
import { bountyRunCost, bountyTierProgress } from "../core/bountyRun";
import { maxSweepCount, sweepRefusal, SWEEP_TICKET_ITEM } from "../core/dungeonShortcut";
import type { PlayerStateDto } from "../api/contracts";
import { findItem } from "../data/items";
import { settingsManager } from "../managers/SettingsManager";
import { openItemGuide } from "../ui/currencyGuideEntry";
import { distinctElements } from "../core/element";
import { heldSweepTickets, sweepTicketState, watchSweepTicketAd } from "./dungeonSweepTickets";
import { combatPower } from "../core/combatPower";
import { getRelic } from "../data/relics";
import { setDebugScene } from "../debug";
import { t } from "../i18n";
import { relicCollection } from "../managers/RelicCollectionManager";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { DUNGEON_LOBBY } from "../ui/dungeonLobbyLayout";
import { DungeonLobby } from "../ui/DungeonLobby";
import { addBackButton } from "../ui/IconButton";
import { drawVignette } from "../ui/holo";
import { PopupLayer } from "../ui/PopupLayer";
import { currencyRecordToRewardItems, openRewardPopup } from "../ui/RewardPopup";
import { addSectionTitle } from "../ui/SectionTitle";
import { TopBar } from "../ui/TopBar";
import { startScene } from "../ui/screenTransition";
import { LOBBY_RETURN } from "./lobbyEntry";
import { prefetchBattlePuppets } from "../puppets/battlePrefetch";
import type { PartySceneData } from "../data/partyContent";
import { consumeSceneEntry } from "./sceneEntry";

/** 편성 화면·결과판에서 돌아올 때 고른 등급을 그대로 되살린다. */
export interface BountySceneData {
  tierId?: string;
}

/**
 * 현상수배 — **정예 셋과 1대1로 세 라운드를 치르는 골드 던전**의 입구.
 *
 * 치즈케이크 대작전과 **같은 입구 한 장**(`DungeonLobby`)이다: 등급을 고르고, 출격하거나 몇 번
 * 소탕할지 골라 소탕한다. 누가 몇 라운드에 나가는지는 **스토리와 같은 편성 화면**이 각 라운드의
 * 정예를 머리 위에 세워 두고 고르게 한다. 하루 입장 제한은 없다 — 스테미나가 곧 한도다.
 *
 * 고른 등급은 설정에 남겨(`rememberDungeonTier`) 다음에 들어와도 그 자리에서 시작한다. 해금·보상은
 * 전부 서버가 확정한 값을 그리기만 한다.
 */
export class BountyScene extends Phaser.Scene {
  private selectedTierId = "";
  private sweepCount = 1;
  private clearedTierIds: readonly string[] = [];
  private adFreeMembership = false;
  private dailyAdRewards?: PlayerStateDto["dailyAdRewards"];
  private busy = false;
  private popups!: PopupLayer;
  private lobby?: DungeonLobby;

  constructor() {
    super("bounty");
  }

  /** 이번 진입이 되살릴 등급. `init`에서 받아 두고 곧바로 비운다(`consumeSceneEntry`). */
  private entry: BountySceneData = {};

  init(data?: BountySceneData): void {
    this.entry = { ...(data ?? {}) };
    consumeSceneEntry(this);
  }

  create(): void {
    // 세 라운드의 적이 등급마다 이미 정해져 있으므로 목록을 보는 동안 전부 읽어 둔다.
    prefetchBattlePuppets(relicCollection.validParty, BOUNTY_TIERS.flatMap((tier) => tier.rounds.map((round) => round.relicId)));
    setDebugScene("bounty");
    this.busy = false;
    this.sweepCount = 1;
    this.clearedTierIds = session.bounty.clearedTierIds;
    // 돌아온 등급 → 마지막으로 고른 등급 → 열린 가장 높은 등급 순이다(`refresh`가 잠긴 값을 고친다).
    const remembered = this.entry.tierId ?? settingsManager.get().game.dungeonTiers.bounty;
    this.selectedTierId = BOUNTY_TIERS.some(({ id }) => id === remembered) ? remembered : "";
    addSceneBackground(this, BACKGROUND.sortieBounty);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { strength: 0.7 });
    new TopBar(this, 40, { profile: false });
    addSectionTitle(this, DUNGEON_LOBBY.title.x, DUNGEON_LOBBY.title.y, t("bounty.title"));
    this.popups = new PopupLayer(this, 2200);
    this.lobby = new DungeonLobby(this, {
      onSelectTier: (id) => { if (!this.busy) { this.selectedTierId = id; settingsManager.rememberDungeonTier("bounty", id); this.refresh(); } },
      onSweepCount: (count) => { if (!this.busy) { this.sweepCount = count; this.refresh(); } },
      onSortie: () => this.openParty(),
      onSweep: () => void this.sweep(),
      onWatchAd: () => void this.watchAd(),
      onTicketInfo: () => { const item = findItem(SWEEP_TICKET_ITEM); if (item) openItemGuide({ scene: this, popups: this.popups }, item); },
    });
    addBackButton(this, () => this.scene.start("lobby", LOBBY_RETURN.sortie));
    this.refresh();
    // 서버가 확정한 해금이 도착하면 그때 목록을 다시 세운다.
    this.reloadStatus();
    // 멤버십 여부와 광고 횟수는 서버 시각으로만 정해진다 — 기기 시계를 돌려 소탕권을 건너뛸 수 없다.
    void gameApi.getPlayerState().then((state) => {
      if (!this.scene.isActive()) return;
      this.adFreeMembership = state.adFreeMembership;
      this.dailyAdRewards = state.dailyAdRewards;
      this.refresh();
    }).catch(() => undefined);
  }

  private reloadStatus(): void {
    void gameApi.getBountyStatus().then((status) => {
      if (!this.scene.isActive()) return;
      this.clearedTierIds = status.clearedTierIds;
      this.refresh();
    }).catch(() => undefined);
  }

  /** 목록·요약·소탕·조작을 한 번에 다시 세운다. 조각만 갈아 끼우면 고른 줄과 비용이 갈린다. */
  private refresh(): void {
    const rows = bountyTierProgress(this.clearedTierIds);
    // 고른 등급이 아직 없거나 잠겼으면 열려 있는 가장 높은 등급으로 내려온다.
    const openRows = rows.filter(({ unlocked }) => unlocked);
    if (!openRows.some(({ tier }) => tier.id === this.selectedTierId)) this.selectedTierId = openRows[openRows.length - 1]?.tier.id ?? rows[0].tier.id;
    const tier = getBountyTier(this.selectedTierId);
    const selected = rows.find((row) => row.tier.id === tier.id);
    const cost = bountyRunCost(tier);
    const tickets = sweepTicketState(this.adFreeMembership, this.dailyAdRewards);
    const maxSweep = maxSweepCount({ stamina: session.wallet.stamina, tickets: heldSweepTickets(), adFreeMembership: this.adFreeMembership, cost });
    this.sweepCount = Math.min(Math.max(1, this.sweepCount), Math.max(1, maxSweep));
    const refusal = sweepRefusal({
      cleared: selected?.cleared === true, count: this.sweepCount, adFreeMembership: this.adFreeMembership,
      tickets: heldSweepTickets(), stamina: session.wallet.stamina, cost,
    });
    const sweepStamina = cost.staminaCost * this.sweepCount;
    this.lobby?.render({
      tiers: rows.map((row) => ({
        id: row.tier.id, name: row.tier.name,
        // 한 등급의 셋은 같은 레벨로 선다.
        level: bountyRoundLevel(row.tier.rounds[0]),
        faces: row.tier.rounds.map((round) => getRelic(round.relicId).portraitAssetId),
        elements: distinctElements(row.tier.rounds.map((round) => getRelic(round.relicId).element)),
        reward: { icon: "currency-gold", amount: row.tier.rewardGold },
        enemyPower: row.tier.rounds.reduce((sum, round) => sum + combatPower(bountyRoundEnemy(round).stats), 0),
        unlocked: row.unlocked,
      })),
      selectedId: tier.id,
      sortieCost: cost.staminaCost,
      sortieAffordable: session.wallet.stamina >= cost.staminaCost,
      sortieEnabled: !this.busy && selected?.unlocked === true && session.wallet.stamina >= cost.staminaCost,
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
    startScene(this, "party", { content: "bounty", tierId: this.selectedTierId } satisfies PartySceneData);
  }

  /** 소탕. 차감과 지급이 서버에서 한 처리로 끝나고 화면은 영수증만 연다. */
  private async sweep(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.refresh();
    const tierId = this.selectedTierId;
    const requestId = `bounty-sweep:${tierId}:${this.sweepCount}:${Date.now()}`;
    try {
      const result = await gameApi.sweepBounty({ tierId, count: this.sweepCount, requestId });
      if (!this.scene.isActive()) return;
      openRewardPopup(this, this.popups, { title: t("dungeon.sweep.title"), items: currencyRecordToRewardItems(result.granted) });
    } catch {
      // 지급이 서지 않았으므로 알릴 것이 없다 — 서버가 확정한 해금만 다시 읽는다.
      this.reloadStatus();
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
