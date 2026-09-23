import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { bountyRoundEnemy, bountyRoundLevel, BOUNTY, BOUNTY_TIERS, getBountyTier } from "../data/bounty";
import { bountyRunCost, bountyTierProgress } from "../core/bountyRun";
import { applyDungeonMultiplier, isMultiplierUnlocked, normalizeMultiplier, sweepRefusal, type DungeonMultiplier } from "../core/dungeonShortcut";
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
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import { startScene } from "../ui/screenTransition";
import { LOBBY_RETURN } from "./lobbyEntry";
import { prefetchBattlePuppets } from "../puppets/battlePrefetch";
import type { PartySceneData } from "../data/partyContent";
import { consumeSceneEntry } from "./sceneEntry";

/** 편성 화면에서 돌아올 때 고른 등급·배율을 그대로 되살린다. */
export interface BountySceneData {
  tierId?: string;
  multiplier?: number;
}

/**
 * 현상수배 — **정예 셋과 1대1로 세 라운드를 치르는 골드 던전**의 입구.
 *
 * 치즈케이크 대작전과 **같은 입구 한 장**(`DungeonLobby`)이다: 등급을 고르고, 배율을 고르고,
 * 출격하거나 소탕한다. 이 화면 아래에 서던 "출전 순서" 칸은 걷어 냈다 — 누가 몇 라운드에
 * 나가는지는 **스토리와 같은 편성 화면**이 각 라운드의 정예를 머리 위에 세워 두고 고르게 한다.
 * 그 자리에는 고른 등급의 적 전투력과 보상이 선다.
 *
 * 해금·입장 횟수·보상은 전부 서버가 확정한 값을 그리기만 한다.
 */
export class BountyScene extends Phaser.Scene {
  private selectedTierId = "";
  private multiplier: DungeonMultiplier = 1;
  private clearedTierIds: readonly string[] = [];
  private entriesRemaining: number = BOUNTY.maxEntriesPerUtcDay;
  private adFreeMembership = false;
  private busy = false;
  private popups!: PopupLayer;
  private lobby?: DungeonLobby;
  private entriesText?: Phaser.GameObjects.Text;
  /** 사람이 등급을 직접 골랐는가(편성에서 돌아온 것도 고른 것이다). */
  private picked = false;

  constructor() {
    super("bounty");
  }

  /** 이번 진입이 되살릴 단계·배율. `init`에서 받아 두고 곧바로 비운다(`consumeSceneEntry`). */
  private entry: BountySceneData = {};

  init(data?: BountySceneData): void {
    this.entry = { ...(data ?? {}) };
    consumeSceneEntry(this);
  }

  create(): void {
    const data = this.entry;
    // 세 라운드의 적이 등급마다 이미 정해져 있으므로 목록을 보는 동안 전부 읽어 둔다.
    prefetchBattlePuppets(relicCollection.validParty, BOUNTY_TIERS.flatMap((tier) => tier.rounds.map((round) => round.relicId)));
    setDebugScene("bounty");
    this.busy = false;
    this.selectedTierId = data?.tierId !== undefined && BOUNTY_TIERS.some(({ id }) => id === data.tierId) ? data.tierId : "";
    this.picked = this.selectedTierId !== "";
    this.multiplier = normalizeMultiplier(data?.multiplier);
    addSceneBackground(this, BACKGROUND.sortieBounty);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { strength: 0.7 });
    new TopBar(this, 40, { profile: false });
    addSectionTitle(this, DUNGEON_LOBBY.title.x, DUNGEON_LOBBY.title.y, t("bounty.title"));
    this.entriesText = this.add.text(DUNGEON_LOBBY.headline.x, DUNGEON_LOBBY.headline.y, "", textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim })).setOrigin(1, 0.5);
    this.popups = new PopupLayer(this, 2200);
    this.lobby = new DungeonLobby(this, {
      onSelectTier: (id) => { if (!this.busy) { this.selectedTierId = id; this.picked = true; this.refresh(); } },
      onSelectMultiplier: (value) => { if (!this.busy) { this.multiplier = value; this.refresh(); } },
      onSortie: () => this.openParty(),
      onSweep: () => void this.sweep(),
    });
    addBackButton(this, () => this.scene.start("lobby", LOBBY_RETURN.sortie));
    this.refresh();
    // 서버가 오늘 날짜로 정규화한 해금·잔여 횟수가 도착하면 그때 목록을 다시 세운다.
    this.reloadStatus();
    // 멤버십 여부는 서버 시각으로만 정해진다 — 기기 시계를 돌려 x3를 열 수 없게 하기 위해서다.
    void gameApi.getPlayerState().then((state) => {
      if (!this.scene.isActive()) return;
      this.adFreeMembership = state.adFreeMembership;
      this.refresh();
    }).catch(() => undefined);
  }

  private reloadStatus(): void {
    void gameApi.getBountyStatus().then((status) => {
      if (!this.scene.isActive()) return;
      // 아직 아무도 고르지 않았으면 해금이 도착한 뒤 **열린 가장 높은 등급**으로 다시 고른다 —
      // 조회 전에는 1급만 열려 보여, 그대로 두면 늘 1급이 골라진 채로 선다.
      if (!this.picked) this.selectedTierId = "";
      this.clearedTierIds = status.clearedTierIds;
      this.entriesRemaining = status.entriesRemaining;
      this.refresh();
    }).catch(() => undefined);
  }

  /**
   * 그 배율을 지금 쓸 수 있는가. 멤버십 규칙에 더해 **남은 입장 횟수**도 묻는다 — 배율 x2는 두
   * 판이라 횟수도 둘을 쓴다(`consumeBountyEntry`).
   */
  private multiplierUsable(value: DungeonMultiplier): boolean {
    return isMultiplierUnlocked(value, this.adFreeMembership) && value <= Math.max(1, this.entriesRemaining);
  }

  /** 목록·요약·배율·조작을 한 번에 다시 세운다. 조각만 갈아 끼우면 고른 줄과 비용이 갈린다. */
  private refresh(): void {
    const rows = bountyTierProgress(this.clearedTierIds);
    // 고른 등급이 아직 없거나 잠겼으면 열려 있는 가장 높은 등급으로 내려온다.
    const openRows = rows.filter(({ unlocked }) => unlocked);
    if (!openRows.some(({ tier }) => tier.id === this.selectedTierId)) this.selectedTierId = openRows[openRows.length - 1]?.tier.id ?? rows[0].tier.id;
    if (!this.multiplierUsable(this.multiplier)) this.multiplier = 1;
    const tier = getBountyTier(this.selectedTierId);
    const selected = rows.find((row) => row.tier.id === tier.id);
    const cost = bountyRunCost(tier);
    const settlement = applyDungeonMultiplier(cost, this.multiplier);
    const affordable = session.wallet.stamina >= settlement.staminaCost;
    const enoughEntries = this.entriesRemaining >= this.multiplier;
    const refusal = sweepRefusal({
      cleared: selected?.cleared === true, multiplier: this.multiplier, adFreeMembership: this.adFreeMembership,
      stamina: session.wallet.stamina, cost,
    });
    this.entriesText?.setText(t("bounty.entries", { remaining: this.entriesRemaining, max: BOUNTY.maxEntriesPerUtcDay }));
    this.lobby?.render({
      tiers: rows.map((row) => ({
        id: row.tier.id, name: row.tier.name,
        // 한 등급의 셋은 같은 레벨로 선다.
        level: bountyRoundLevel(row.tier.rounds[0]),
        faces: row.tier.rounds.map((round) => getRelic(round.relicId).portraitAssetId),
        reward: { icon: "currency-gold", amount: row.tier.rewardGold },
        enemyPower: row.tier.rounds.reduce((sum, round) => sum + combatPower(bountyRoundEnemy(round).stats), 0),
        unlocked: row.unlocked,
      })),
      selectedId: tier.id,
      multiplier: this.multiplier,
      multiplierUnlocked: (value) => this.multiplierUsable(value),
      staminaCost: settlement.staminaCost,
      affordable,
      sortieEnabled: !this.busy && selected?.unlocked === true && affordable && enoughEntries,
      sweepEnabled: !this.busy && refusal === null && enoughEntries,
    });
  }

  /** 출격은 편성 화면을 연다. 입장(스테미나·입장 횟수 차감)은 거기서 전투 시작을 누를 때 확정된다. */
  private openParty(): void {
    if (this.busy) return;
    startScene(this, "party", { content: "bounty", tierId: this.selectedTierId, multiplier: this.multiplier } satisfies PartySceneData);
  }

  /** 소탕. 차감과 지급이 서버에서 한 처리로 끝나고 화면은 영수증만 연다. */
  private async sweep(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.refresh();
    const tierId = this.selectedTierId;
    const requestId = `bounty-sweep:${tierId}:${this.multiplier}:${Date.now()}`;
    try {
      const result = await gameApi.sweepBounty({ tierId, multiplier: this.multiplier, requestId });
      if (!this.scene.isActive()) return;
      this.entriesRemaining = result.entriesRemaining;
      openRewardPopup(this, this.popups, { title: t("dungeon.sweep.title"), items: currencyRecordToRewardItems(result.granted) });
    } catch {
      // 지급이 서지 않았으므로 알릴 것이 없다 — 서버가 확정한 잔여 횟수만 다시 읽는다.
      this.reloadStatus();
    } finally {
      this.busy = false;
      if (this.scene.isActive()) this.refresh();
    }
  }
}
