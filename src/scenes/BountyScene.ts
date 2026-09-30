import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { bountyRoundEnemy, bountyRoundLevel, BOUNTY_TIERS, getBountyTier } from "../data/bounty";
import { bountyRunCost, bountyTierProgress } from "../core/bountyRun";
import type { PlayerStateDto } from "../api/contracts";
import { settingsManager } from "../managers/SettingsManager";
import { distinctElements } from "../core/element";
import { openDungeonSweep } from "./dungeonSweepFlow";
import { combatPower } from "../core/combatPower";
import { getRelic } from "../data/relics";
import { setDebugScene } from "../debug";
import { t } from "../i18n";
import { relicCollection } from "../managers/RelicCollectionManager";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND, battleFieldBackground } from "../ui/backgrounds";
import { DUNGEON_LOBBY } from "../ui/dungeonLobbyLayout";
import { DungeonLobby } from "../ui/DungeonLobby";
import { addBackButton } from "../ui/IconButton";
import { drawVignette } from "../ui/holo";
import { PopupLayer } from "../ui/PopupLayer";
import { bindCurrencyGuide, openCurrencyGuide } from "../ui/currencyGuideEntry";
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
    this.clearedTierIds = session.bounty.clearedTierIds;
    // 돌아온 등급 → 마지막으로 고른 등급 → 열린 가장 높은 등급 순이다(`refresh`가 잠긴 값을 고친다).
    const remembered = this.entry.tierId ?? settingsManager.get().game.dungeonTiers.bounty;
    this.selectedTierId = BOUNTY_TIERS.some(({ id }) => id === remembered) ? remembered : "";
    addSceneBackground(this, BACKGROUND.sortieBounty);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { strength: 0.7 });
    new TopBar(this, 40, { profile: false, onCurrency: (currency) => openCurrencyGuide({ scene: this, popups: this.popups }, currency) });
    addSectionTitle(this, DUNGEON_LOBBY.title.x, DUNGEON_LOBBY.title.y, t("bounty.title"));
    this.popups = new PopupLayer(this, 2200);
    // 소탕 창의 스테미나·소탕권 그림도 같은 안내창으로 이어진다(`addFramedIcon`·`guideForIcon`).
    bindCurrencyGuide({ scene: this, popups: this.popups });
    this.lobby = new DungeonLobby(this, {
      onSelectTier: (id) => { if (!this.busy) { this.selectedTierId = id; settingsManager.rememberDungeonTier("bounty", id); this.refresh(); } },
      onSortie: () => this.openParty(),
      onSweep: () => this.sweep(),
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
      sweepEnabled: !this.busy && selected?.cleared === true,
    });
  }

  /** 출격은 편성 화면을 연다. 입장(스테미나 차감)은 거기서 전투 시작을 누를 때 확정된다. */
  private openParty(): void {
    if (this.busy) return;
    startScene(this, "party", { content: "bounty", tierId: this.selectedTierId } satisfies PartySceneData);
  }

  /** 소탕 — 배율을 고르는 창을 열고, 누르면 연출과 서버 요청이 나란히 돈 뒤 영수증이 열린다. */
  private sweep(): void {
    if (this.busy) return;
    const tier = getBountyTier(this.selectedTierId);
    openDungeonSweep({
      scene: this, popups: this.popups,
      tierName: tier.name, level: bountyRoundLevel(tier.rounds[0]), cost: bountyRunCost(tier),
      cleared: this.clearedTierIds.includes(tier.id),
      enemyId: tier.rounds[tier.rounds.length - 1].relicId,
      fieldKey: battleFieldBackground("bounty"),
      membership: () => this.adFreeMembership,
      dailyAdRewards: () => this.dailyAdRewards,
      setDailyAdRewards: (daily) => { this.dailyAdRewards = daily; },
      request: (count) => gameApi.sweepBounty({ tierId: tier.id, count, requestId: `bounty-sweep:${tier.id}:${count}:${Date.now()}` }),
      setBusy: (busy) => { this.busy = busy; if (this.scene.isActive()) this.refresh(); },
      onFailed: () => this.reloadStatus(),
    });
  }

}
