import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { gameApi } from "../api/FakeServer";
import { session } from "../state/session";
import { CAKE_OPERATION_TIERS, cakeOperationEnemies, cakeOperationRunCost, cakeOperationTierIndex, isCakeTierUnlocked, type CakeOperationTier } from "../data/cakeOperation";
import { applyDungeonMultiplier, isMultiplierUnlocked, normalizeMultiplier, sweepRefusal, type DungeonMultiplier } from "../core/dungeonShortcut";
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

/** 편성 화면에서 돌아올 때 고른 단계·배율을 그대로 되살린다. */
export interface CakeOperationSceneData {
  tierId?: string;
  multiplier?: number;
}

/**
 * **치즈케이크 대작전** — 레이티아 다섯 자매가 한꺼번에 몰려오는 물량형 던전의 입구.
 *
 * 화면은 현상수배와 같은 입구 한 장(`DungeonLobby`)이다: 단계를 고르고, 몇 판치를 한 번에
 * 치를지(배율) 고르고, 출격하거나 소탕한다. **출격은 곧바로 전투로 가지 않고 편성 화면을
 * 연다** — 스토리와 같은 화면에서 몰려올 얼굴을 보고 데려갈 셋을 고른 뒤, 거기서 입장이
 * 확정된다(스테미나도 그때 나간다).
 *
 * 잠긴 단계와 잠긴 배율은 **조작만 감추고 말은 하지 않는다**.
 */
export class CakeOperationScene extends Phaser.Scene {
  private selectedTierId = CAKE_OPERATION_TIERS[0].id;
  private multiplier: DungeonMultiplier = 1;
  private adFreeMembership = false;
  private busy = false;
  private popups!: PopupLayer;
  private lobby?: DungeonLobby;

  constructor() {
    super("cakeOperation");
  }

  /** 이번 진입이 되살릴 단계·배율. `init`에서 받아 두고 곧바로 비운다(`consumeSceneEntry`). */
  private entry: CakeOperationSceneData = {};

  init(data?: CakeOperationSceneData): void {
    this.entry = { ...(data ?? {}) };
    consumeSceneEntry(this);
  }

  create(): void {
    const data = this.entry;
    // 단계를 고르는 동안 전투에 설 SD를 미리 읽는다. 다섯 자매는 속성만 다른 같은 몸이지만
    // **원화는 저마다 다르므로** 다섯을 다 읽어야 한 무리가 통째로 늦게 서지 않는다.
    prefetchBattlePuppets(relicCollection.validParty, CAKE_OPERATION_ENEMY_IDS);
    setDebugScene("cakeOperation", t("cake.title"));
    this.busy = false;
    // 편성에서 돌아왔으면 고르던 단계를, 아니면 마지막으로 이긴 단계의 다음 칸을 고른다.
    const next = Math.min(session.cakeOperation.clearedIndex + 1, CAKE_OPERATION_TIERS.length - 1);
    const returning = data?.tierId !== undefined && cakeOperationTierIndex(data.tierId) >= 0 ? data.tierId : undefined;
    this.selectedTierId = returning ?? CAKE_OPERATION_TIERS[Math.max(0, next)].id;
    this.multiplier = normalizeMultiplier(data?.multiplier);

    addSceneBackground(this, BACKGROUND.sortieCake);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { strength: 0.72 });
    new TopBar(this, 40, { profile: false });
    addSectionTitle(this, DUNGEON_LOBBY.title.x, DUNGEON_LOBBY.title.y, t("cake.title"));
    this.popups = new PopupLayer(this, 2200);
    this.lobby = new DungeonLobby(this, {
      onSelectTier: (id) => { if (!this.busy) { this.selectedTierId = id; this.refresh(); } },
      onSelectMultiplier: (value) => { if (!this.busy) { this.multiplier = value; this.refresh(); } },
      onSortie: () => this.openParty(),
      onSweep: () => void this.sweep(),
    });
    this.refresh();
    addBackButton(this, () => this.scene.start("lobby", LOBBY_RETURN.sortie));

    // 멤버십 여부는 서버 시각으로만 정해진다 — 기기 시계를 돌려 x3를 열 수 없게 하기 위해서다.
    void gameApi.getPlayerState().then((state) => {
      if (!this.scene.isActive()) return;
      this.adFreeMembership = state.adFreeMembership;
      this.refresh();
    }).catch(() => undefined);
  }

  private selectedTier(): CakeOperationTier {
    return CAKE_OPERATION_TIERS[cakeOperationTierIndex(this.selectedTierId)];
  }

  /** 고른 단계·배율·해금 상태를 한 번에 화면에 반영한다. */
  private refresh(): void {
    const clearedIndex = session.cakeOperation.clearedIndex;
    if (!isMultiplierUnlocked(this.multiplier, this.adFreeMembership)) this.multiplier = 1;
    const tier = this.selectedTier();
    const cost = cakeOperationRunCost(tier);
    const settlement = applyDungeonMultiplier(cost, this.multiplier);
    const affordable = session.wallet.stamina >= settlement.staminaCost;
    const refusal = sweepRefusal({
      cleared: cakeOperationTierIndex(tier.id) <= clearedIndex,
      multiplier: this.multiplier, adFreeMembership: this.adFreeMembership,
      stamina: session.wallet.stamina, cost,
    });
    this.lobby?.render({
      tiers: CAKE_OPERATION_TIERS.map((entry) => ({
        id: entry.id, name: entry.name, level: entry.enemyLevel, ferocityLevel: entry.ferocityLevel,
        reward: { icon: "currency-cheesecake", amount: entry.rewardCheesecake },
        enemyPower: cakeOperationEnemies(entry).reduce((sum, def) => sum + combatPower(def.stats), 0),
        unlocked: isCakeTierUnlocked(entry.id, clearedIndex),
      })),
      selectedId: tier.id,
      multiplier: this.multiplier,
      multiplierUnlocked: (value) => isMultiplierUnlocked(value, this.adFreeMembership),
      staminaCost: settlement.staminaCost,
      affordable,
      sortieEnabled: !this.busy && affordable,
      sweepEnabled: !this.busy && refusal === null,
    });
  }

  /** 출격은 편성 화면을 연다. 입장(스테미나 차감)은 거기서 전투 시작을 누를 때 확정된다. */
  private openParty(): void {
    if (this.busy) return;
    startScene(this, "party", { content: "cake", tierId: this.selectedTierId, multiplier: this.multiplier } satisfies PartySceneData);
  }

  /** 소탕. 차감과 지급이 서버에서 한 처리로 끝나고 화면은 영수증만 연다. */
  private async sweep(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.refresh();
    const tier = this.selectedTier();
    const requestId = `cake-sweep:${tier.id}:${this.multiplier}:${Date.now()}`;
    try {
      const result = await gameApi.sweepCakeOperation({ tierId: tier.id, multiplier: this.multiplier, requestId });
      if (!this.scene.isActive()) return;
      openRewardPopup(this, this.popups, { title: t("dungeon.sweep.title"), items: currencyRecordToRewardItems(result.granted) });
    } catch {
      // 지급이 서지 않았으므로 알릴 것이 없다 — 조작만 되돌린다.
    } finally {
      this.busy = false;
      if (this.scene.isActive()) this.refresh();
    }
  }
}
