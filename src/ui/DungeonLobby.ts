import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { DUNGEON_MULTIPLIERS, type DungeonMultiplier } from "../core/dungeonShortcut";
import { formatCurrency } from "../core/formatCurrency";
import { t } from "../i18n";
import type { PortraitAssetId } from "../core/types";
import { Button } from "./Button";
import type { CurrencyIconKey } from "./currencyIcons";
import { DUNGEON_LOBBY, dungeonActionButtonX, dungeonMultiplierChipX, dungeonRowCenterY, dungeonRowFaceX } from "./dungeonLobbyLayout";
import { FaceFrame } from "./FaceFrame";
import { addSectionTitle } from "./SectionTitle";
import { chipPoints, drawLayer, HOLO, slantedRect } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { COLOR, textStyle } from "./theme";

/** 목록 한 줄이 그리는 단계. 화면(씬)이 제 데이터에서 만들어 넘긴다. */
export interface DungeonLobbyTier {
  id: string;
  name: string;
  /** 줄에 서는 적의 레벨 — 화면에 선 `LV.n`이 곧 그 적이 싸우는 레벨이다. */
  level: number;
  /** 그 판에 서는 적의 얼굴(현상수배의 세 라운드). 비우면 줄에 얼굴을 세우지 않는다. */
  faces?: readonly PortraitAssetId[];
  /** 한 판(배율 x1)의 보상. */
  reward: { icon: CurrencyIconKey; amount: number };
  /** 그 판에 서는 적 전부의 종합 전투력. 표시 전용이다. */
  enemyPower: number;
  unlocked: boolean;
}

/** 화면이 매번 통째로 넘기는 상태. 조각만 갈아 끼우면 고른 줄과 버튼 비용이 갈린다. */
export interface DungeonLobbyState {
  tiers: readonly DungeonLobbyTier[];
  selectedId: string;
  multiplier: DungeonMultiplier;
  multiplierUnlocked: (value: DungeonMultiplier) => boolean;
  /** 고른 단계·배율의 스테미나(배율을 먹인 값)와 지금 치를 수 있는지. */
  staminaCost: number;
  affordable: boolean;
  sortieEnabled: boolean;
  sweepEnabled: boolean;
}

export interface DungeonLobbyHandlers {
  onSelectTier: (id: string) => void;
  onSelectMultiplier: (value: DungeonMultiplier) => void;
  onSortie: () => void;
  onSweep: () => void;
}

/**
 * 던전 입구 — **현상수배와 치즈케이크 대작전이 함께 쓰는 한 장**.
 *
 * 두 화면이 하는 일은 같다: 단계를 고르고, 배율을 고르고, 출격하거나 소탕한다. 각자 그리던
 * 때는 같은 손짓이 한 화면에서는 편성 칸, 다른 화면에서는 배율 칩으로 섰다. 이제 목록 · 요약 판
 * (적 전투력 · 보상) · 배율 · 조작 네 층이 같은 자리·같은 양식으로 서고, 편성은 두 곳 모두
 * **스토리와 같은 편성 화면**(`PartyScene`)이 맡는다.
 *
 * 비용과 보상을 곱하는 일은 이 판이 하지 않는다 — 씬이 단축 규칙(`dungeonShortcut`)으로 구한
 * 값을 넘기고, 실제 차감과 지급은 서버 경계가 확정한다.
 */
export class DungeonLobby {
  private readonly layer: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, private readonly handlers: DungeonLobbyHandlers) {
    this.layer = scene.add.container(0, 0);
  }

  render(state: DungeonLobbyState): void {
    this.layer.removeAll(true);
    state.tiers.forEach((tier, index) => this.addRow(tier, index, tier.id === state.selectedId));
    const selected = state.tiers.find(({ id }) => id === state.selectedId);
    if (selected) this.addSummary(selected, state.multiplier);
    this.addMultiplierChips(state);
    this.addActions(state);
  }

  /** 한 줄. 이름·레벨이 왼쪽에, (있으면) 적 얼굴과 한 판의 보상이 오른쪽에 선다. */
  private addRow(tier: DungeonLobbyTier, index: number, selected: boolean): void {
    const { scene } = this;
    const { width, height, padding, rewardSize, faceSize } = DUNGEON_LOBBY.row;
    const y = dungeonRowCenterY(index);
    const shape = chipPoints(width, height, { bevel: { topLeft: 24, topRight: 0, bottomRight: 24, bottomLeft: 0 } });
    const row = scene.add.container(BASE_WIDTH / 2, y);
    row.add(drawLayer(scene, 0, 0, shape, { fill: COLOR.panel, alpha: 0.82, edge: COLOR.accent, edgeAlpha: 0.32 }));
    // 고른 줄은 테두리가 아니라 **더 밝은 윗선과 옅은 칠**로 알린다 — 사방을 두르지 않는 화면 규칙이다.
    if (selected) row.add(drawLayer(scene, 0, 0, shape, { fill: COLOR.accent, alpha: 0.12, edge: COLOR.accent, edgeAlpha: 0.95, edgeWidth: 5 }));

    const left = -width / 2 + padding;
    row.add(scene.add.text(left, -22, tier.name, textStyle({ role: "display", size: 36, color: COLOR.ink })).setOrigin(0, 0.5));
    row.add(scene.add.text(left, 28, t("dungeon.tier.level", { level: tier.level }), textStyle({ role: "emphasis", size: 25, color: COLOR.inkDim })).setOrigin(0, 0.5));
    tier.faces?.forEach((portraitAssetId, slot, faces) => {
      row.add(new FaceFrame(scene, dungeonRowFaceX(slot, faces.length), 0, { portraitAssetId, size: faceSize }));
    });
    // 한 판(배율 x1)이 주는 값이다. 배율을 먹인 수는 아래 요약 판이 말한다.
    row.add(addFramedIcon(scene, undefined, width / 2 - padding - rewardSize / 2, 0, rewardSize, tier.reward.icon, { amount: formatCurrency(tier.reward.amount), plain: true }));

    // 잠긴 줄은 흐려지고 손을 받지 않는 것으로만 알린다 — 왜 잠겼는지를 적는 문장은 세우지 않는다.
    if (tier.unlocked) {
      row.setSize(width, height).setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.POINTER_UP, () => this.handlers.onSelectTier(tier.id));
    } else {
      row.setAlpha(0.34);
    }
    this.layer.add(row);
  }

  /**
   * 고른 단계의 **적 전투력 · 보상**. 들어갈지 말지를 정하는 두 수만 남긴다.
   *
   * 전투력은 편성 화면의 대치선이 쓰는 것과 같은 합(`combatPower`)이라, 여기서 본 수가 편성에서
   * 아군 전투력과 마주 선다. 보상은 **배율을 먹인 값**이다 — 줄의 액자가 한 판의 값을 말하므로,
   * 같은 수를 두 번 세우지 않고 이 판이 "지금 누르면 받는 것"을 맡는다.
   */
  private addSummary(tier: DungeonLobbyTier, multiplier: DungeonMultiplier): void {
    const { scene } = this;
    const { y, width, height } = DUNGEON_LOBBY.summary;
    const panel = scene.add.container(BASE_WIDTH / 2, y);
    panel.add(drawLayer(scene, 0, 0, slantedRect(width, height, 26), { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.panelEdge, edgeAlpha: 0.85 }));
    const half = width / 2;
    const divider = 40;
    // 두 이름표는 판 윗변에 걸터앉는 제목표다 — 판 안의 회색 글자로 두면 같은 위계의 제목이
    // 이 판에서만 맨 글자가 된다. 값은 그 아래 판 가운데 높이로 내려선다.
    const titleY = -height / 2 - 4;
    addSectionTitle(scene, -half, titleY, t("dungeon.enemyPower"), { parent: panel });
    const valueY = 10;
    // 왼쪽 절반 — 적 전투력.
    panel.add(scene.add.text(-half + 48, valueY, tier.enemyPower.toLocaleString(), textStyle({ role: "display", size: 46, color: COLOR.dangerText })).setOrigin(0, 0.5));
    // 가운데를 가르는 얇은 선 — 두 수가 한 문장으로 읽히지 않게 한다.
    panel.add(scene.add.rectangle(divider, 0, 2, height - 44, COLOR.panelEdge, 0.6));
    // 오른쪽 절반 — 보상(배율을 먹인 값). 제목표는 가르는 선 바로 오른쪽에서 시작한다.
    addSectionTitle(scene, divider + DUNGEON_LOBBY.summary.titleGap, titleY, t("dungeon.reward"), { parent: panel });
    const size = 88;
    panel.add(addFramedIcon(scene, undefined, half - 48 - size / 2, valueY, size, tier.reward.icon, { amount: formatCurrency(tier.reward.amount * multiplier) }));
    if (multiplier > 1) {
      panel.add(scene.add.text(divider + 48, valueY, t("dungeon.multiplier", { value: multiplier }), textStyle({ role: "display", size: 34, color: COLOR.accentText })).setOrigin(0, 0.5));
    }
    this.layer.add(panel);
  }

  /** x1·x2·x3. 잠긴 칩도 자리는 지키되 눌리지 않고, 왜 잠겼는지는 적지 않는다. */
  private addMultiplierChips(state: DungeonLobbyState): void {
    const { scene } = this;
    const { y, chipWidth, chipHeight } = DUNGEON_LOBBY.multiplier;
    DUNGEON_MULTIPLIERS.forEach((value, index) => {
      const unlocked = state.multiplierUnlocked(value);
      const chip = scene.add.container(dungeonMultiplierChipX(index, DUNGEON_MULTIPLIERS.length), y);
      chip.add(drawLayer(scene, 0, 0, slantedRect(chipWidth, chipHeight, 22), { fill: COLOR.panel, alpha: 0.82, edge: COLOR.accent, edgeAlpha: 0.4 }));
      chip.add(scene.add.text(0, 0, t("dungeon.multiplier", { value }), textStyle({ role: "display", size: 38, color: COLOR.ink })).setOrigin(0.5));
      // 고른 배율은 색이 아니라 크기로 알린다 — 누르면 커지는 화면 규칙 그대로다.
      chip.setScale(value === state.multiplier ? 1.12 : 1).setAlpha(unlocked ? 1 : 0.34);
      if (unlocked) {
        chip.setSize(chipWidth, chipHeight).setInteractive({ useHandCursor: true })
          .on(Phaser.Input.Events.POINTER_UP, () => this.handlers.onSelectMultiplier(value));
      }
      this.layer.add(chip);
    });
  }

  /** 출격·소탕. 비용 표기는 버튼 안에서 말한다 — 판 안에 액자를 넣으면 판이 두 겹이 된다. */
  private addActions(state: DungeonLobbyState): void {
    const { scene } = this;
    const { y, width, height } = DUNGEON_LOBBY.action;
    const cost = { icon: "currency-stamina" as const, amount: state.staminaCost, affordable: state.affordable };
    const sortie = new Button(scene, dungeonActionButtonX(0), y, {
      width, height, label: t("dungeon.sortie"), variant: "primary", cost, onClick: () => this.handlers.onSortie(),
    });
    sortie.setEnabled(state.sortieEnabled);
    const sweep = new Button(scene, dungeonActionButtonX(1), y, {
      width, height, label: t("dungeon.sweep"), cost, onClick: () => this.handlers.onSweep(),
    });
    sweep.setEnabled(state.sweepEnabled);
    this.layer.add([sortie, sweep]);
  }
}
