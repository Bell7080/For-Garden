import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { gameApi } from "../api/FakeServer";
import { session } from "../state/session";
import { CAKE_OPERATION_TIERS, cakeOperationRunCost, cakeOperationTierIndex, isCakeTierUnlocked, type CakeOperationTier } from "../data/cakeOperation";
import { DUNGEON_MULTIPLIERS, applyDungeonMultiplier, isMultiplierUnlocked, sweepRefusal, type DungeonMultiplier } from "../core/dungeonShortcut";
import { CAKE_ACTION_BUTTON, CAKE_MULTIPLIER_CHIP, CAKE_ROW, CAKE_TITLE, cakeActionButtonX, cakeActionRowY, cakeMultiplierChipX, cakeMultiplierRowY, cakeRowCenterY } from "../ui/cakeOperationLayout";
import { addBackButton } from "../ui/IconButton";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { addSectionTitle } from "../ui/SectionTitle";
import { addFramedIcon } from "../ui/itemFrame";
import { Button } from "../ui/Button";
import { PopupLayer } from "../ui/PopupLayer";
import { openRewardPopup, currencyRecordToRewardItems } from "../ui/RewardPopup";
import { TopBar } from "../ui/TopBar";
import { chipPoints, drawLayer, drawVignette, slantedRect } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { LOBBY_RETURN } from "./lobbyEntry";

/**
 * **치즈케이크 대작전** — 레이티아 거대겨울잠쥐가 떼로 몰려오는 물량형 던전의 입구.
 *
 * 화면이 하는 일은 셋뿐이다: 어느 단계로 들어갈지 고르고, 몇 판치를 한 번에 치를지(배율)
 * 고르고, 싸우러 가거나(출격) 전투 없이 털거나(소탕) 한다. 재화 차감과 보상 지급은 화면이
 * 하지 않고 전부 `GameApi` 경계를 지난다 — 배율을 곱하는 일도 화면이 다시 하지 않고
 * 서버가 확정한 `granted`를 그대로 그린다.
 *
 * 잠긴 단계와 잠긴 배율은 **조작만 감추고 말은 하지 않는다**. 왜 잠겼는지를 적는 문장은
 * 플레이어가 지금 할 일을 바꾸지 않는다.
 */
export class CakeOperationScene extends Phaser.Scene {
  private selectedTierId = CAKE_OPERATION_TIERS[0].id;
  private multiplier: DungeonMultiplier = 1;
  private adFreeMembership = false;
  private busy = false;
  private popups!: PopupLayer;
  private rows: { tier: CakeOperationTier; row: Phaser.GameObjects.Container; mark: Phaser.GameObjects.Graphics; hit: Phaser.GameObjects.Rectangle }[] = [];
  private multiplierMarks: { chip: Phaser.GameObjects.Container; value: DungeonMultiplier }[] = [];
  private actionRow?: Phaser.GameObjects.Container;

  constructor() {
    super("cakeOperation");
  }

  create(): void {
    setDebugScene("cakeOperation", t("cake.title"));
    this.busy = false;
    this.rows = [];
    this.multiplierMarks = [];
    this.actionRow = undefined;
    // 마지막으로 이긴 단계의 다음 칸이 기본 선택이다 — 들어오자마자 고를 것이 이미 골라져 있다.
    const next = Math.min(session.cakeOperation.clearedIndex + 1, CAKE_OPERATION_TIERS.length - 1);
    this.selectedTierId = CAKE_OPERATION_TIERS[Math.max(0, next)].id;
    this.multiplier = 1;

    addSceneBackground(this, BACKGROUND.sortieCake);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { strength: 0.72 });
    new TopBar(this, 40, { profile: false });
    addSectionTitle(this, CAKE_TITLE.x, CAKE_TITLE.y, t("cake.title"));
    this.popups = new PopupLayer(this, 2200);

    CAKE_OPERATION_TIERS.forEach((tier, index) => this.buildRow(tier, index));
    this.buildMultiplierChips();
    this.refresh();
    addBackButton(this, () => this.scene.start("lobby", LOBBY_RETURN.sortie));

    // 멤버십 여부는 서버 시각으로만 정해진다 — 기기 시계를 돌려 x3를 열 수 없게 하기 위해서다.
    void gameApi.getPlayerState().then((state) => {
      if (!this.scene.isActive()) return;
      this.adFreeMembership = state.adFreeMembership;
      this.refresh();
    }).catch(() => undefined);
  }

  /** 단계 한 줄. 이름·레벨·야성 단계가 왼쪽에, 한 판이 주는 치즈케이크가 오른쪽에 선다. */
  private buildRow(tier: CakeOperationTier, index: number): void {
    const y = cakeRowCenterY(index);
    const shape = chipPoints(CAKE_ROW.width, CAKE_ROW.height, { bevel: { topLeft: 26, topRight: 0, bottomRight: 26, bottomLeft: 0 } });
    const row = this.add.container(BASE_WIDTH / 2, y);
    row.add(drawLayer(this, 0, 0, shape, { fill: COLOR.panel, alpha: 0.82, edge: COLOR.accent, edgeAlpha: 0.32 }));
    // 고른 줄은 테두리가 아니라 **더 밝은 윗선**으로 알린다 — 사방을 두르지 않는 화면 규칙이다.
    const mark = drawLayer(this, 0, 0, shape, { fill: COLOR.accent, alpha: 0.12, edge: COLOR.accent, edgeAlpha: 0.95, edgeWidth: 5 });
    row.add(mark);

    row.add(this.add.text(-CAKE_ROW.width / 2 + CAKE_ROW.padding, -26, tier.name, textStyle({ role: "display", size: 38, color: COLOR.ink })).setOrigin(0, 0.5));
    const level = this.add.text(-CAKE_ROW.width / 2 + CAKE_ROW.padding, 28, t("cake.tier.enemy", { level: tier.enemyLevel }), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5);
    row.add(level);
    // 야성 몫은 곱하기 전의 **단계**이고, 레벨과 갈라 읽히도록 작고 붉게 옆에 선다.
    if (tier.ferocityLevel > 0) {
      row.add(this.add.text(level.x + level.width + 10, 28, t("cake.tier.bonus", { bonus: tier.ferocityLevel }), textStyle({ role: "emphasis", size: 22, color: COLOR.ferocityText })).setOrigin(0, 0.5));
    }
    row.add(this.add.text(-CAKE_ROW.width / 2 + CAKE_ROW.padding + 250, 28, t("cake.tier.waves", { waves: tier.waves.length }), textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));

    // 한 판(배율 x1)이 주는 값이다. 배율을 먹인 수는 누르는 것 위(버튼)가 말한다.
    row.add(addFramedIcon(this, undefined, CAKE_ROW.width / 2 - CAKE_ROW.padding - 44, 0, 88, "currency-cheesecake", { amount: String(tier.rewardCheesecake), plain: true }));

    const hit = this.add.rectangle(BASE_WIDTH / 2, y, CAKE_ROW.width, CAKE_ROW.height, 0x000000, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => {
      if (this.busy || !isCakeTierUnlocked(tier.id, session.cakeOperation.clearedIndex)) return;
      this.selectedTierId = tier.id;
      this.refresh();
    });
    this.rows.push({ tier, row, mark, hit });
  }

  /** x1·x2·x3. 잠긴 칩도 자리는 지키되 눌리지 않고, 왜 잠겼는지는 적지 않는다. */
  private buildMultiplierChips(): void {
    const y = cakeMultiplierRowY(CAKE_OPERATION_TIERS.length);
    DUNGEON_MULTIPLIERS.forEach((value, index) => {
      const chip = this.add.container(cakeMultiplierChipX(index, DUNGEON_MULTIPLIERS.length), y);
      chip.add(drawLayer(this, 0, 0, slantedRect(CAKE_MULTIPLIER_CHIP.width, CAKE_MULTIPLIER_CHIP.height, 22), { fill: COLOR.panel, alpha: 0.82, edge: COLOR.accent, edgeAlpha: 0.4 }));
      chip.add(this.add.text(0, 0, t("cake.multiplier", { value }), textStyle({ role: "display", size: 38, color: COLOR.ink })).setOrigin(0.5));
      const hit = this.add.rectangle(chip.x, chip.y, CAKE_MULTIPLIER_CHIP.width, CAKE_MULTIPLIER_CHIP.height, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => {
        if (this.busy || !isMultiplierUnlocked(value, this.adFreeMembership)) return;
        this.multiplier = value;
        this.refresh();
      });
      this.multiplierMarks.push({ chip, value });
    });
  }

  /** 고른 단계·배율·해금 상태를 한 번에 화면에 반영한다. */
  private refresh(): void {
    const clearedIndex = session.cakeOperation.clearedIndex;
    // 고른 줄은 밝은 윗선으로, 잠긴 줄은 흐려지고 손을 받지 않는 것으로 알린다.
    // 왜 잠겼는지를 적는 문장은 세우지 않는다 — 그 글이 없어도 할 수 있는 조작은 같다.
    this.rows.forEach(({ tier, row, mark, hit }) => {
      const unlocked = isCakeTierUnlocked(tier.id, clearedIndex);
      mark.setAlpha(tier.id === this.selectedTierId ? 1 : 0);
      row.setAlpha(unlocked ? 1 : 0.34);
      if (unlocked) hit.setInteractive({ useHandCursor: true }); else hit.disableInteractive();
    });
    // 멤버십이 없으면 x3는 눌리지 않고 흐리게만 남는다.
    if (!isMultiplierUnlocked(this.multiplier, this.adFreeMembership)) this.multiplier = 1;
    this.multiplierMarks.forEach(({ chip, value }) => {
      const unlocked = isMultiplierUnlocked(value, this.adFreeMembership);
      chip.setAlpha(unlocked ? 1 : 0.34);
      // 고른 배율은 색이 아니라 크기로 알린다 — 누르면 커지는 화면 규칙 그대로다.
      chip.setScale(value === this.multiplier ? 1.12 : 1);
    });
    this.buildActionRow();
  }

  /** 출격·소탕 두 조작. 값이 바뀌면 버튼의 비용 표기도 함께 다시 선다. */
  private buildActionRow(): void {
    this.actionRow?.destroy(true);
    const row = this.add.container(0, 0);
    this.actionRow = row;
    const tier = CAKE_OPERATION_TIERS[cakeOperationTierIndex(this.selectedTierId)];
    const cost = cakeOperationRunCost(tier);
    const settlement = applyDungeonMultiplier(cost, this.multiplier);
    const y = cakeActionRowY(CAKE_OPERATION_TIERS.length);
    const affordable = session.wallet.stamina >= settlement.staminaCost;

    const sortie = new Button(this, cakeActionButtonX(0), y, {
      width: CAKE_ACTION_BUTTON.width, height: CAKE_ACTION_BUTTON.height, label: t("cake.sortie"), variant: "primary",
      cost: { icon: "currency-stamina", amount: settlement.staminaCost, affordable },
      onClick: () => void this.enter(tier),
    });
    sortie.setEnabled(!this.busy && affordable);
    row.add(sortie);

    const refusal = sweepRefusal({
      cleared: cakeOperationTierIndex(tier.id) <= session.cakeOperation.clearedIndex,
      multiplier: this.multiplier, adFreeMembership: this.adFreeMembership,
      stamina: session.wallet.stamina, cost,
    });
    const sweep = new Button(this, cakeActionButtonX(1), y, {
      width: CAKE_ACTION_BUTTON.width, height: CAKE_ACTION_BUTTON.height, label: t("cake.sweep"),
      cost: { icon: "currency-stamina", amount: settlement.staminaCost, affordable },
      onClick: () => void this.sweep(tier),
    });
    sweep.setEnabled(!this.busy && refusal === null);
    row.add(sweep);
  }

  /** 입장. 스테미나는 이 경계에서 한 번 빠지고, 그 영수증의 요청 ID가 전투를 따라간다. */
  private async enter(tier: CakeOperationTier): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.refresh();
    const requestId = `cake:${tier.id}:${this.multiplier}:${Date.now()}`;
    try {
      await gameApi.enterCakeOperation({ tierId: tier.id, multiplier: this.multiplier, requestId });
      if (!this.scene.isActive()) return;
      this.scene.start("battle", { mode: "cake", tierId: tier.id, multiplier: this.multiplier, requestId });
    } catch {
      // 차감이 서지 않았으므로 화면은 있던 자리로 돌아가기만 한다.
      this.busy = false;
      if (this.scene.isActive()) this.refresh();
    }
  }

  /** 소탕. 차감과 지급이 서버에서 한 처리로 끝나고 화면은 영수증만 연다. */
  private async sweep(tier: CakeOperationTier): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.refresh();
    const requestId = `cake-sweep:${tier.id}:${this.multiplier}:${Date.now()}`;
    try {
      const result = await gameApi.sweepCakeOperation({ tierId: tier.id, multiplier: this.multiplier, requestId });
      if (!this.scene.isActive()) return;
      openRewardPopup(this, this.popups, { title: t("cake.sweep.title"), items: currencyRecordToRewardItems(result.granted) });
    } catch {
      // 지급이 서지 않았으므로 알릴 것이 없다 — 조작만 되돌린다.
    } finally {
      this.busy = false;
      if (this.scene.isActive()) this.refresh();
    }
  }
}
