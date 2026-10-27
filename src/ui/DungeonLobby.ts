import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { formatCurrency } from "../core/formatCurrency";
import type { Element, Role } from "../core/types";
import { t } from "../i18n";
import { battleAssetFor, spawnPuppet } from "../puppets/assets";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addPopupBackgroundImage } from "./backgrounds";
import { Button } from "./Button";
import type { CurrencyIconKey } from "./currencyIcons";
import { DUNGEON_LOBBY, dungeonActionButtonX, dungeonLineupSpot, dungeonStripChipX, dungeonSummaryCard } from "./dungeonLobbyLayout";
import type { DungeonTheme } from "./dungeonTheme";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { addPadlock } from "./Padlock";
import { pressIn, pressOut } from "./pressFeedback";
import { addSdFootShadow } from "./SdFootShadow";
import { addSectionTitle } from "./SectionTitle";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { addUnitNameplate, addUnitPower } from "./unitNameplate";
import { addBreakthroughGradeMark } from "./rarityMark";

/** 무대에 서는 적 하나. */
export interface DungeonLineupUnit {
  relicId: string;
  name: string;
  level: number;
  /** 편성 화면의 적과 같은 표식 — 속성·직군(왼쪽 위), 돌파 등급(오른쪽 위), 개체 전투력(발밑). */
  element: Element;
  role: Role;
  breakthrough: number;
  power: number;
  /** 현상수배만 — 몇 라운드에 서는 정예인지(1부터). */
  round?: number;
}

/** 한 단계. 화면(씬)이 제 데이터에서 만들어 넘긴다. */
export interface DungeonLobbyTier {
  id: string;
  name: string;
  /** 그 판의 적이 싸우는 레벨 — 화면에 선 `LV.n`이 곧 실제로 싸우는 레벨이다. */
  level: number;
  /** 무대에 세울 적. 물량형은 몰려오는 수 그대로 세우고 앞줄 다섯만 이름줄·표식을 단다. */
  lineup: readonly DungeonLineupUnit[];
  hordeCount?: number;
  /** 그 판에 서는 적의 속성 — 겹치지 않게 처음 나오는 순서로. 편성 전에 상성을 읽게 한다. */
  elements: readonly Element[];
  /** 한 판의 보상. */
  reward: { icon: CurrencyIconKey; amount: number };
  /** 그 판에 서는 적 전부의 종합 전투력. 표시 전용이다. */
  enemyPower: number;
  unlocked: boolean;
  cleared: boolean;
}

/** 화면이 매번 통째로 넘기는 상태. 조각만 갈아 끼우면 고른 칸과 버튼 비용이 갈린다. */
export interface DungeonLobbyState {
  tiers: readonly DungeonLobbyTier[];
  selectedId: string;
  /** 출격 한 판의 스테미나와 지금 치를 수 있는지. */
  sortieCost: number;
  sortieAffordable: boolean;
  sortieEnabled: boolean;
  /** 소탕 창을 열 수 있는가(이긴 단계). 횟수·소탕권은 그 창(`openSweepPopup`)이 고른다. */
  sweepEnabled: boolean;
}

export interface DungeonLobbyHandlers {
  onSelectTier: (id: string) => void;
  onSortie: () => void;
  onSweep: () => void;
}

export interface DungeonLobbyOptions {
  theme: DungeonTheme;
  /** 무대에 깔 그 콘텐츠의 전장 원화(`battleFieldBackground`). */
  fieldKey: string;
}

/**
 * 던전 입구 — **현상수배와 치즈케이크 대작전이 함께 쓰는 한 장**.
 *
 * 위에서부터 **전장 무대**(고른 단계의 적이 그 콘텐츠의 전장 원화 위에 SD로 선다 — 결투 방어팀
 * 미리보기와 같은 문법) → **난이도 번호 줄** → 적 전투력·속성·보상 판 → 출격·소탕이다. 단계는 번호를
 * 누르거나, 무대를 좌우로 밀거나, 무대 양옆의 꺾쇠로 넘긴다. **잠긴 단계도 넘겨 볼 수 있다** — 무엇이
 * 기다리는지 보여야 오를 이유가 생긴다. 잠긴 단계는 무대에 자물쇠가 서고 출격이 꺼질 뿐 이유를
 * 문장으로 적지 않는다.
 *
 * 무엇이 다른 던전인지는 색이 말한다(`DungeonTheme` — 치즈빛 · 푸른 소라빛). 비용과 보상을 곱하는
 * 일은 이 판이 하지 않는다 — 씬이 구한 값을 넘기고, 실제 차감과 지급은 서버 경계가 확정한다.
 */
export class DungeonLobby {
  /** 번호 줄·요약·조작 — 상태가 바뀔 때마다 통째로 다시 세운다. */
  private readonly layer: Phaser.GameObjects.Container;
  /** 무대 — 원화·띠·화살표는 한 번만 세우고 적 줄만 단계가 바뀔 때 갈아 끼운다. */
  private readonly stage: Phaser.GameObjects.Container;
  private readonly stageChrome: Phaser.GameObjects.Container;
  private lineup?: Phaser.GameObjects.Container;
  private shownTierId?: string;
  private lineupRequest = 0;
  private state?: DungeonLobbyState;
  private swipeFrom?: number;

  constructor(private readonly scene: Phaser.Scene, private readonly handlers: DungeonLobbyHandlers, private readonly options: DungeonLobbyOptions) {
    const S = DUNGEON_LOBBY.stage;
    this.stage = scene.add.container(BASE_WIDTH / 2, S.y);
    this.paintStageBase();
    this.stageChrome = scene.add.container(0, 0);
    this.stage.add(this.stageChrome);
    this.layer = scene.add.container(0, 0);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.lineupRequest += 1; });
  }

  render(state: DungeonLobbyState): void {
    const previous = this.state?.tiers.findIndex(({ id }) => id === this.shownTierId) ?? -1;
    this.state = state;
    this.layer.removeAll(true);
    const index = state.tiers.findIndex(({ id }) => id === state.selectedId);
    const selected = state.tiers[index];
    if (!selected) return;
    if (selected.id !== this.shownTierId) {
      this.shownTierId = selected.id;
      this.paintLineup(selected, previous < 0 ? 0 : Math.sign(index - previous));
    }
    this.paintStageChrome(state, index);
    this.addStrip(state);
    this.addSummary(selected);
    this.addActions(state);
  }

  /* ── 무대 ──────────────────────────────────────────────────────────────── */

  /** 전장 원화 · 윗선 · 밀어 넘기는 입력면. 단계가 바뀌어도 그대로 남는다. */
  private paintStageBase(): void {
    const { scene } = this;
    const S = DUNGEON_LOBBY.stage;
    const { theme } = this.options;
    const shape = chipPoints(S.width, S.height, { bevel: { topLeft: S.bevel, bottomRight: S.bevel } });
    this.stage.add(drawLayer(scene, 0, 0, shape, { fill: 0x05070a, alpha: 1 }));
    addPopupBackgroundImage(scene, this.stage, this.options.fieldKey, { x: 0, y: 0, width: S.width, height: S.height, maskShape: shape, overlayStrength: 0.55 });
    // 위쪽 이름 띠 — 원화 위에서 단계 이름이 읽히도록 무대와 같은 깎임으로 짙게 누른다.
    const band = chipPoints(S.width, S.band, { bevel: { topLeft: S.bevel } });
    this.stage.add(drawLayer(scene, 0, -S.height / 2 + S.band / 2, band, { fill: theme.deep, alpha: 0.72, shadow: false }));
    // 윗변 한 줄만 테마 색으로 — 사방을 두르지 않는 화면 규칙이다.
    this.stage.add(drawLayer(scene, 0, 0, shape, { fill: 0x000000, alpha: 0, edge: theme.accent, edgeAlpha: 0.95, edgeWidth: 5, shadow: false }));
    const hit = scene.add.rectangle(0, 0, S.width, S.height, 0xffffff, 0).setInteractive();
    hit.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => { this.swipeFrom = pointer.x; });
    hit.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (this.swipeFrom === undefined) return;
      const dx = pointer.x - this.swipeFrom;
      this.swipeFrom = undefined;
      if (Math.abs(dx) >= S.swipe) this.step(dx < 0 ? 1 : -1);
    });
    hit.on(Phaser.Input.Events.POINTER_OUT, () => { this.swipeFrom = undefined; });
    this.stage.add(hit);
  }

  /** 옆 단계로 넘긴다. 끝에서는 멈춘다(돌아 감기지 않는다 — 1단계 옆이 마지막 단계면 사다리가 끊겨 읽힌다). */
  private step(direction: number): void {
    const state = this.state;
    if (!state) return;
    const index = state.tiers.findIndex(({ id }) => id === state.selectedId);
    const next = state.tiers[index + direction];
    if (next) this.handlers.onSelectTier(next.id);
  }

  /** 이름 띠의 글자 · 클리어 표식 · 잠금 · 넘김 화살표. 상태마다 다시 세운다. */
  private paintStageChrome(state: DungeonLobbyState, index: number): void {
    const { scene } = this;
    const S = DUNGEON_LOBBY.stage;
    const { theme } = this.options;
    const tier = state.tiers[index];
    this.stageChrome.removeAll(true);
    const bandY = -S.height / 2 + S.band / 2;
    const left = -S.width / 2 + S.bevel + 28;
    // 단계 이름이 크게, 그 옆에 적 레벨이 테마 색으로 선다.
    const name = squeezeTextToWidth(scene.add.text(left, bandY - 4, tier.name, textStyle({ role: "display", size: 52, color: COLOR.ink })).setOrigin(0, 0.5).setStroke("#05070a", 6), 470);
    this.stageChrome.add(name);
    this.stageChrome.add(scene.add.text(left + name.displayWidth + 22, bandY + 4, t("dungeon.tier.level", { level: tier.level }), textStyle({ role: "display", size: 34, color: theme.accentText })).setOrigin(0, 0.5).setStroke("#05070a", 5));
    // 오른쪽 끝 — 몇 번째 단계인지, 깼으면 테마 색 체크가 그 앞에 붙는다.
    const right = S.width / 2 - 34;
    const page = scene.add.text(right, bandY, `${index + 1} / ${state.tiers.length}`, textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim })).setOrigin(1, 0.5);
    this.stageChrome.add(page);
    if (tier.cleared) {
      const x = right - page.width - 40;
      this.stageChrome.add(drawLayer(scene, x, bandY, chipPoints(52, 52, { bevel: { topLeft: 12, bottomRight: 12 } }), { fill: theme.accent, alpha: 0.95, shadow: false }));
      this.stageChrome.add(drawGlyph(scene, "check", x, bandY, 30, theme.deep, 1, 5));
    }
    // 물량형은 대표 얼굴만 서므로 한꺼번에 몰려오는 수를 무대 밑동 가운데에 따로 적는다.
    if (tier.hordeCount !== undefined) {
      this.stageChrome.add(scene.add.text(0, S.height / 2 - 30, t("party.hordeCount", { count: tier.hordeCount }), textStyle({ role: "display", size: 32, color: theme.accentText }))
        .setOrigin(0.5, 1).setStroke("#05070a", 6));
    }
    if (!tier.unlocked) {
      const shade = chipPoints(S.width, S.height - S.band, { bevel: { bottomRight: S.bevel } });
      this.stageChrome.add(drawLayer(scene, 0, S.band / 2, shade, { fill: 0x05070a, alpha: 0.62, shadow: false }));
      // 자물쇠는 이름 띠의 클리어 표식 자리에 선다 — 무대 가운데에 크게 세우면 가운데 적의 얼굴을 덮는다.
      this.stageChrome.add(addPadlock(scene, right - page.width - 40, bandY - 2, 46, { color: COLOR.inkHex, shadow: true }));
    }
    // 넘김 꺾쇠 — 옆 단계가 있을 때만 선다.
    for (const direction of [-1, 1] as const) {
      if (!state.tiers[index + direction]) continue;
      this.stageChrome.add(this.addArrow(direction));
    }
  }

  private addArrow(direction: -1 | 1): Phaser.GameObjects.Container {
    const { scene } = this;
    const { arrow, width } = DUNGEON_LOBBY.stage;
    const { theme } = this.options;
    const x = direction * (width / 2 + arrow.outset);
    const button = scene.add.container(x, 20);
    button.add(drawLayer(scene, 0, 0, chipPoints(arrow.size * 0.82, arrow.size * 1.3, { bevel: { topLeft: 14, bottomRight: 14 } }), { fill: theme.deep, alpha: 0.7, shadow: false }));
    button.add(drawGlyph(scene, direction < 0 ? "page-prev" : "page-next", 0, 0, arrow.size * 0.56, theme.accent, 1, 6));
    button.setSize(arrow.size * 1.2, arrow.size * 1.6).setInteractive({ useHandCursor: true });
    button.on(Phaser.Input.Events.POINTER_DOWN, () => pressIn(button));
    button.on(Phaser.Input.Events.POINTER_OUT, () => pressOut(button, "normal", { pop: false }));
    button.on(Phaser.Input.Events.POINTER_UP, () => { pressOut(button); this.step(direction); });
    return button;
  }

  /**
   * 그 단계의 적 줄. 단계가 바뀔 때만 갈아 끼운다 — 소탕 중 버튼 상태처럼 다른 값이 바뀔 때 SD를
   * 다시 세우면 원화가 빠졌다 들어와 새로고침된 것처럼 읽힌다. 새 줄을 먼저 세우고 옛 줄을 걷는다.
   */
  private paintLineup(tier: DungeonLobbyTier, direction: number): void {
    const { scene } = this;
    const { theme } = this.options;
    const request = ++this.lineupRequest;
    const previous = this.lineup;
    // 층은 셋 — 발밑 그림자 → SD → 이름줄·라운드 표. 늦게 도착한 SD가 그림자 위·글자 아래에 끼어든다.
    const lineup = scene.add.container(direction * 80, 0).setAlpha(0);
    const ground = scene.add.container(0, 0), figures = scene.add.container(0, 0), labels = scene.add.container(0, 0);
    lineup.add([ground, figures, labels]);
    // 무대의 입력면(바닥) 바로 위·띠 아래에 끼운다.
    this.stage.addAt(lineup, this.stage.getIndex(this.stageChrome));
    this.lineup = lineup;
    const count = tier.lineup.length;
    // 앞줄(가운데·짝수 자리)이 뒷줄 위에 그려지도록 뒤쪽부터 세운다.
    const order = tier.lineup.map((_unit, index) => index).sort((a, b) => dungeonLineupSpot(a, count).ground - dungeonLineupSpot(b, count).ground);
    for (const index of order) {
      const unit = tier.lineup[index];
      const spot = dungeonLineupSpot(index, count);
      const { height } = spot;
      addSdFootShadow(scene, spot.x, spot.ground, height * 0.72, ground);
      const slot = scene.add.container(0, 0);
      figures.add(slot);
      void spawnPuppet(scene, battleAssetFor(unit.relicId), {
        x: spot.x, groundY: spot.ground, height, depth: 0, flipX: true,
        isStale: () => request !== this.lineupRequest || !slot.active,
      }).then((puppet) => {
        if (request !== this.lineupRequest || !slot.active) { puppet.destroy(); return; }
        puppet.disableInteractive();
        slot.add(puppet);
      }).catch(() => undefined);
      if (!spot.labeled) continue;
      // **편성 화면의 적과 같은 어휘로 선다** — 속성·직군은 왼쪽 위, 돌파 등급은 오른쪽 위, 개체 전투력은
      // 발밑, 레벨·이름은 그 아래 한 줄. 물량형 앞줄은 칸이 좁아 표식만 한 뼘 작게 세우고 돌파 등급은 뺀다.
      const k = height / 210;
      const badgeTop = spot.ground - height + 34 * k;
      if (spot.crowd) {
        labels.add(new AffinityBadge(scene, spot.x - 62, badgeTop, ELEMENT_ICON[unit.element], 42, 0.62));
        labels.add(new AffinityBadge(scene, spot.x - 62, badgeTop + 40, ROLE_ICON[unit.role], 32, 0.62));
      } else {
        labels.add(new AffinityBadge(scene, spot.x - 104 * k, badgeTop, ELEMENT_ICON[unit.element], 52 * k, 0.62));
        labels.add(new AffinityBadge(scene, spot.x - 104 * k, badgeTop + 49 * k, ROLE_ICON[unit.role], 38 * k, 0.62));
        addBreakthroughGradeMark(scene, labels, spot.x + 104 * k, badgeTop - 4, 42 * k, unit.breakthrough + 1);
      }
      addUnitPower(scene, labels, spot.x, spot.ground + 18, unit.power, spot.crowd ? 20 : 26, COLOR.dangerText);
      addUnitNameplate(scene, labels, spot.x, spot.ground + 22, unit.level, unit.name, spot.crowd ? 24 : 30, spot.crowd ? 150 : 270);
      if (unit.round !== undefined) {
        // 라운드 표 — 테마 색 판에 짙은 글자. 정수리 위에 서서 그 정예가 몇 번째 상대인지 말한다.
        const y = spot.ground - height - 34;
        labels.add(drawLayer(scene, spot.x, y, chipPoints(150, 46, { bevel: { topLeft: 12, bottomRight: 12 } }), { fill: theme.accent, alpha: 0.95 }));
        labels.add(scene.add.text(spot.x, y, t("bounty.formation.round", { round: unit.round }), textStyle({ role: "display", size: 26, color: theme.deepText })).setOrigin(0.5));
      }
    }
    scene.tweens.add({ targets: lineup, x: 0, alpha: 1, duration: 200, ease: "Cubic.Out" });
    if (previous) {
      scene.tweens.add({
        targets: previous, x: -direction * 80, alpha: 0, duration: 160, ease: "Cubic.In",
        onComplete: () => previous.destroy(),
      });
    }
  }

  /* ── 난이도 줄 ─────────────────────────────────────────────────────────── */

  /** 번호 칸 줄. 고른 칸은 테마 색으로 차며 한 뼘 크고, 깬 칸은 아래에 테마 색 띠, 잠긴 칸은 자물쇠다. */
  private addStrip(state: DungeonLobbyState): void {
    const { scene } = this;
    const L = DUNGEON_LOBBY.strip;
    const { theme } = this.options;
    addSectionTitle(scene, 72, L.titleY, t("dungeon.difficulty"), { parent: this.layer });
    state.tiers.forEach((tier, index) => {
      const selected = tier.id === state.selectedId;
      const chip = scene.add.container(dungeonStripChipX(index, state.tiers.length), L.y);
      const shape = chipPoints(L.chipWidth, L.chipHeight, { bevel: { topLeft: 16, bottomRight: 16 } });
      chip.add(drawLayer(scene, 0, 0, shape, selected
        ? { fill: theme.accent, alpha: 0.96, edge: 0xffffff, edgeAlpha: 0.9, edgeWidth: 3 }
        : { fill: COLOR.panel, alpha: 0.88, edge: theme.accent, edgeAlpha: tier.unlocked ? 0.45 : 0.15 }));
      if (tier.unlocked) {
        chip.add(scene.add.text(0, -4, `${index + 1}`, textStyle({ role: "display", size: 40, color: selected ? theme.deepText : COLOR.ink })).setOrigin(0.5));
      } else {
        chip.add(addPadlock(scene, 0, -4, 38, { color: selected ? theme.deep : COLOR.inkHex, alpha: selected ? 0.9 : 0.5 }));
      }
      // 깬 단계는 밑동에 테마 색 띠 — 어디까지 왔는지가 줄 하나로 읽힌다.
      if (tier.cleared) chip.add(scene.add.rectangle(0, L.chipHeight / 2 - 12, L.chipWidth - 30, 6, selected ? theme.deep : theme.accent, selected ? 0.8 : 0.95));
      if (selected) chip.setScale(L.selectedScale);
      chip.setSize(L.chipWidth, L.chipHeight).setInteractive({ useHandCursor: true });
      chip.on(Phaser.Input.Events.POINTER_UP, () => { if (!selected) this.handlers.onSelectTier(tier.id); });
      this.layer.add(chip);
    });
  }

  /* ── 요약 · 조작 ───────────────────────────────────────────────────────── */

  /**
   * 고른 단계의 **적 전투력·속성 · 보상**. 전투력은 편성 화면의 대치선이 쓰는 것과 같은 합이라
   * 여기서 본 수가 편성에서 아군 전투력과 마주 선다. 속성은 그 옆 뱃지로 — 자동 편성이 속성으로
   * 사람을 고르므로 편성에 들어가기 전에 무엇에 약한 적인지가 읽혀야 한다.
   */
  private addSummary(tier: DungeonLobbyTier): void {
    const { scene } = this;
    const { element, reward } = DUNGEON_LOBBY.summary;
    const bodyY = DUNGEON_LOBBY.summary.header / 2;
    const power = this.addSummaryCard(0, t("dungeon.enemyPower"));
    const powerCard = dungeonSummaryCard(0);
    const value = scene.add.text(-powerCard.width / 2 + 34, bodyY, tier.enemyPower.toLocaleString(), textStyle({ role: "display", size: 54, color: COLOR.dangerText })).setOrigin(0, 0.5);
    power.add(value);
    const last = powerCard.width / 2 - element.rightInset - element.size / 2;
    tier.elements.forEach((entry, index) => {
      const x = last - (tier.elements.length - 1 - index) * element.step;
      power.add(new AffinityBadge(scene, x, bodyY, ELEMENT_ICON[entry], element.size, 0.62));
    });
    const rewardCard = dungeonSummaryCard(1);
    const prize = this.addSummaryCard(1, t("dungeon.reward"));
    const iconX = -rewardCard.width / 2 + 30 + reward.icon / 2;
    prize.add(addFramedIcon(scene, undefined, iconX, bodyY, reward.icon, tier.reward.icon));
    const amount = scene.add.text(iconX + reward.icon / 2 + 18, bodyY, formatCurrency(tier.reward.amount), textStyle({ role: "display", size: 44, color: this.options.theme.accentText })).setOrigin(0, 0.5);
    squeezeTextToWidth(amount, rewardCard.width / 2 - 24 - amount.x);
    prize.add(amount);
  }

  /**
   * 요약 카드 한 장 — 깎인 유리판 위에 테마 색으로 물든 머리 띠와 빗금 이름표가 선다. 판 안의 몸통 좌표는
   * 카드 중심 기준이고 머리 띠만큼 아래로 내려 앉는다.
   */
  private addSummaryCard(index: 0 | 1, label: string): Phaser.GameObjects.Container {
    const { scene } = this;
    const { theme } = this.options;
    const { y, height, header, bevel } = DUNGEON_LOBBY.summary;
    const { x, width } = dungeonSummaryCard(index);
    const card = scene.add.container(x, y);
    const shape = chipPoints(width, height, { bevel: { topLeft: bevel, bottomRight: bevel } });
    card.add(drawLayer(scene, 0, 0, shape, { fill: theme.deep, alpha: 0.86, edge: theme.accent, edgeAlpha: 0.95, edgeWidth: 4 }));
    // 머리 띠 — 판과 같은 깎임을 따라 윗부분만 테마 색으로 옅게 물든다.
    const band = scene.add.graphics();
    band.fillStyle(theme.accent, 0.16);
    const top = -height / 2;
    band.fillPoints([
      new Phaser.Math.Vector2(-width / 2 + bevel, top), new Phaser.Math.Vector2(width / 2, top),
      new Phaser.Math.Vector2(width / 2, top + header), new Phaser.Math.Vector2(-width / 2, top + header),
      new Phaser.Math.Vector2(-width / 2, top + bevel),
    ], true);
    band.fillStyle(theme.accent, 0.5);
    band.fillRect(-width / 2 + 18, top + header, width - 36, 2);
    card.add(band);
    const slashX = -width / 2 + bevel + 16;
    const headerY = top + header / 2 + 1;
    card.add(scene.add.text(slashX, headerY, "/", textStyle({ role: "display", size: 28, color: theme.accentText })).setOrigin(0, 0.5));
    const name = scene.add.text(slashX + 24, headerY, label, textStyle({ role: "emphasis", size: 26, color: theme.accentText })).setOrigin(0, 0.5);
    squeezeTextToWidth(name, width / 2 - 20 - name.x);
    card.add(name);
    this.layer.add(card);
    return card;
  }

  /** 출격·소탕. 출격은 한 판의 비용을 버튼 안에서 말하고, 소탕의 비용은 소탕 창이 말한다. */
  private addActions(state: DungeonLobbyState): void {
    const { scene } = this;
    const { y, width, height } = DUNGEON_LOBBY.action;
    const { theme } = this.options;
    const sortie = new Button(scene, dungeonActionButtonX(0), y, {
      width, height, label: t("dungeon.sortie"), variant: "primary", fill: theme.deep, accentColor: theme.accent, accentTextColor: theme.accentText, decorDots: true,
      cost: { icon: "currency-stamina", amount: state.sortieCost, affordable: state.sortieAffordable },
      onClick: () => this.handlers.onSortie(),
    });
    sortie.setEnabled(state.sortieEnabled);
    const sweep = new Button(scene, dungeonActionButtonX(1), y, {
      // 꺼져 있어도 판이 보여야 자리가 읽힌다 — 기본 유리판은 원화 위에서 글자만 남았다.
      width, height, label: t("dungeon.sweep"), fill: theme.deep,
      onClick: () => this.handlers.onSweep(),
    });
    sweep.setEnabled(state.sweepEnabled);
    // 공용 꺼짐(0.35)은 밝은 원화 위에서 판째 사라져 자리가 읽히지 않았다 — 입구의 두 버튼은 조금 덜 흐린다.
    for (const button of [sortie, sweep]) if (button.alpha < 1) button.setAlpha(0.62);
    this.layer.add([sortie, sweep]);
  }
}
