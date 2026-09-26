import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { formatCurrency } from "../core/formatCurrency";
import type { Element } from "../core/types";
import { findItem } from "../data/items";
import { SWEEP_TICKET_ITEM } from "../core/dungeonShortcut";
import { t } from "../i18n";
import type { PortraitAssetId } from "../core/types";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON } from "./affinityIcons";
import { Button } from "./Button";
import type { CurrencyIconKey } from "./currencyIcons";
import { DUNGEON_LOBBY, dungeonActionButtonX, dungeonRowCenterY, dungeonRowFaceX, dungeonSweepControlX } from "./dungeonLobbyLayout";
import { FaceFrame } from "./FaceFrame";
import { addSectionTitle } from "./SectionTitle";
import { chipPoints, drawLayer, HOLO, slantedRect } from "./holo";
import { addFramedIcon, addItemFrame, ITEM_FRAME } from "./itemFrame";
import { addItemDefinitionIcon } from "./itemDefinitionIcon";
import { pressIn, pressOut } from "./pressFeedback";
import { COLOR, textStyle } from "./theme";

/** 목록 한 줄이 그리는 단계. 화면(씬)이 제 데이터에서 만들어 넘긴다. */
export interface DungeonLobbyTier {
  id: string;
  name: string;
  /** 줄에 서는 적의 레벨 — 화면에 선 `LV.n`이 곧 그 적이 싸우는 레벨이다. */
  level: number;
  /** 그 판에 서는 적의 얼굴(현상수배의 세 라운드). 비우면 줄에 얼굴을 세우지 않는다. */
  faces?: readonly PortraitAssetId[];
  /** 그 판에 서는 적의 속성 — 겹치지 않게 처음 나오는 순서로. 편성 전에 상성을 읽게 한다. */
  elements: readonly Element[];
  /** 한 판의 보상. */
  reward: { icon: CurrencyIconKey; amount: number };
  /** 그 판에 서는 적 전부의 종합 전투력. 표시 전용이다. */
  enemyPower: number;
  unlocked: boolean;
}

/** 멤버십이 없을 때 소탕 줄 오른쪽에 서는 소탕권과 광고. */
export interface DungeonLobbyTickets {
  held: number;
  /** 오늘 더 볼 수 있는 광고 수와 하루 한도. */
  adRemaining: number;
  adLimit: number;
  /** 광고 한 번에 채워지는 장수. */
  adQuantity: number;
}

/** 화면이 매번 통째로 넘기는 상태. 조각만 갈아 끼우면 고른 줄과 버튼 비용이 갈린다. */
export interface DungeonLobbyState {
  tiers: readonly DungeonLobbyTier[];
  selectedId: string;
  /** 출격 한 판의 스테미나와 지금 치를 수 있는지. */
  sortieCost: number;
  sortieAffordable: boolean;
  sortieEnabled: boolean;
  /** 고른 소탕 횟수와, 지금 한 번에 할 수 있는 최대(0이면 한 번도 못 한다). */
  sweepCount: number;
  maxSweep: number;
  /** 고른 횟수만큼의 스테미나. */
  sweepCost: number;
  sweepAffordable: boolean;
  sweepEnabled: boolean;
  /** 멤버십이면 비운다 — 소탕권이 들지 않는다. */
  tickets?: DungeonLobbyTickets;
}

export interface DungeonLobbyHandlers {
  onSelectTier: (id: string) => void;
  onSweepCount: (count: number) => void;
  onSortie: () => void;
  onSweep: () => void;
  onWatchAd: () => void;
  onTicketInfo: () => void;
}

/**
 * 던전 입구 — **현상수배와 치즈케이크 대작전이 함께 쓰는 한 장**.
 *
 * 두 화면이 하는 일은 같다: 단계를 고르고, 출격하거나 몇 번 소탕할지 골라 소탕한다. 목록 · 요약 판
 * (적 전투력·속성 · 보상) · 소탕 횟수 · 조작 네 층이 같은 자리·같은 양식으로 서고, 편성은 두 곳
 * 모두 **스토리와 같은 편성 화면**(`PartyScene`)이 맡는다.
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
    if (selected) this.addSummary(selected);
    this.addSweepRow(state);
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
    // 한 판이 주는 값이다.
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
   * 고른 단계의 **적 전투력·속성 · 보상**. 들어갈지 말지와 누구를 데려갈지를 정하는 값만 남긴다.
   *
   * 전투력은 편성 화면의 대치선이 쓰는 것과 같은 합(`combatPower`)이라, 여기서 본 수가 편성에서
   * 아군 전투력과 마주 선다. 속성은 그 옆에 뱃지로 선다 — 자동 편성이 속성으로 사람을 고르므로
   * 편성에 들어가기 전에 무엇에 약한 적인지가 읽혀야 한다. 보상은 한 판의 값이다.
   */
  private addSummary(tier: DungeonLobbyTier): void {
    const { scene } = this;
    const { y, width, height, element } = DUNGEON_LOBBY.summary;
    const panel = scene.add.container(BASE_WIDTH / 2, y);
    panel.add(drawLayer(scene, 0, 0, slantedRect(width, height, 26), { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.panelEdge, edgeAlpha: 0.85 }));
    const half = width / 2;
    const divider = 40;
    // 두 이름표는 판 윗변에 걸터앉는 제목표다 — 판 안의 회색 글자로 두면 같은 위계의 제목이
    // 이 판에서만 맨 글자가 된다. 값은 그 아래 판 가운데 높이로 내려선다.
    const titleY = -height / 2 - 4;
    addSectionTitle(scene, -half, titleY, t("dungeon.enemyPower"), { parent: panel });
    const valueY = 10;
    // 왼쪽 절반 — 적 전투력과 그 오른쪽 끝의 속성 뱃지.
    panel.add(scene.add.text(-half + 48, valueY, tier.enemyPower.toLocaleString(), textStyle({ role: "display", size: 46, color: COLOR.dangerText })).setOrigin(0, 0.5));
    const last = divider - element.rightInset - element.size / 2;
    tier.elements.forEach((value, index) => {
      const x = last - (tier.elements.length - 1 - index) * element.step;
      panel.add(new AffinityBadge(scene, x, valueY, ELEMENT_ICON[value], element.size, 0.62));
    });
    // 가운데를 가르는 얇은 선 — 두 수가 한 문장으로 읽히지 않게 한다.
    panel.add(scene.add.rectangle(divider, 0, 2, height - 44, COLOR.panelEdge, 0.6));
    // 오른쪽 절반 — 한 판의 보상. 제목표는 가르는 선 바로 오른쪽에서 시작한다.
    addSectionTitle(scene, divider + DUNGEON_LOBBY.summary.titleGap, titleY, t("dungeon.reward"), { parent: panel });
    const size = 88;
    panel.add(addFramedIcon(scene, undefined, half - 48 - size / 2, valueY, size, tier.reward.icon, { amount: formatCurrency(tier.reward.amount) }));
    this.layer.add(panel);
  }

  /**
   * 소탕 횟수 줄. **− 횟수 + MAX**가 왼쪽, (멤버십이 없으면) **소탕권 · 광고**가 오른쪽이다.
   *
   * 횟수는 1에서 시작해 최대(스테미나와 소탕권 중 먼저 떨어지는 쪽)까지 오른다. 한 번도 못 하면
   * 1에 머물고 소탕 버튼이 꺼진다 — 줄을 통째로 숨기면 무엇이 모자란지 읽히지 않는다.
   */
  private addSweepRow(state: DungeonLobbyState): void {
    const { scene } = this;
    const { y, height, step, count: countWidth, max: maxWidth, ticket, ad } = DUNGEON_LOBBY.sweep;
    const x = dungeonSweepControlX();
    const cap = Math.max(1, state.maxSweep);
    const stepper = (cx: number, width: number, label: string, target: number, enabled: boolean): void => {
      const button = new Button(scene, cx, y, { width, height, label, fontSize: 34, onClick: () => this.handlers.onSweepCount(target) });
      button.setEnabled(enabled);
      this.layer.add(button);
    };
    stepper(x.minus, step, "-", state.sweepCount - 1, state.sweepCount > 1);
    const count = scene.add.container(x.count, y);
    count.add(drawLayer(scene, 0, 0, slantedRect(countWidth, height, 18), { fill: COLOR.panel, alpha: 0.82, edge: COLOR.accent, edgeAlpha: 0.4 }));
    count.add(scene.add.text(0, 0, t("dungeon.sweep.count", { count: state.sweepCount }), textStyle({ role: "display", size: 38, color: COLOR.ink })).setOrigin(0.5));
    this.layer.add(count);
    stepper(x.plus, step, "+", state.sweepCount + 1, state.sweepCount < cap);
    stepper(x.max, maxWidth, t("dungeon.sweep.max"), cap, state.sweepCount < cap);

    const tickets = state.tickets;
    if (!tickets) return;
    const definition = findItem(SWEEP_TICKET_ITEM);
    // 소탕권 — 가방과 같은 액자 한 장에 가진 수가 우하단으로 겹친다. 누르면 안내창이 뜬다.
    const frame = addItemFrame(scene, x.ticket, y, ticket);
    if (definition) {
      const iconSize = ticket * ITEM_FRAME.icon;
      frame.add(addItemDefinitionIcon(scene, definition.icon, ITEM_FRAME.shadow.offsetX, ITEM_FRAME.shadow.offsetY, iconSize, { shadow: true }));
      frame.add(addItemDefinitionIcon(scene, definition.icon, 0, 0, iconSize));
    }
    frame.add(scene.add.text(ticket / 2 - 8, ticket / 2 - 6, tickets.held.toLocaleString(), textStyle({ role: "display", size: Math.round(ticket * ITEM_FRAME.amountRatio), color: tickets.held > 0 ? COLOR.accentText : COLOR.dangerText }))
      .setOrigin(1, 1).setStroke("#000000", 6).setShadow(2, 3, "#000000", 2, false, true));
    frame.setSize(ticket, ticket).setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, () => pressIn(frame))
      .on(Phaser.Input.Events.POINTER_OUT, () => pressOut(frame, "normal", { pop: false }))
      .on(Phaser.Input.Events.POINTER_UP, () => { pressOut(frame); this.handlers.onTicketInfo(); });
    this.layer.add(frame);
    // 광고 — 한 번에 소탕권 몇 장. 오늘 남은 횟수는 버튼 아래 줄이 말한다.
    const watch = new Button(scene, x.ad, y, {
      width: ad, height, label: t("dungeon.sweep.ad", { count: tickets.adQuantity }), fontSize: 28,
      sub: t("dungeon.sweep.adUsage", { used: tickets.adLimit - tickets.adRemaining, limit: tickets.adLimit }), subFontSize: 20,
      onClick: () => this.handlers.onWatchAd(),
    });
    watch.setEnabled(tickets.adRemaining > 0);
    this.layer.add(watch);
  }

  /** 출격·소탕. 비용 표기는 버튼 안에서 말한다 — 판 안에 액자를 넣으면 판이 두 겹이 된다. */
  private addActions(state: DungeonLobbyState): void {
    const { scene } = this;
    const { y, width, height } = DUNGEON_LOBBY.action;
    const sortie = new Button(scene, dungeonActionButtonX(0), y, {
      width, height, label: t("dungeon.sortie"), variant: "primary",
      cost: { icon: "currency-stamina", amount: state.sortieCost, affordable: state.sortieAffordable },
      onClick: () => this.handlers.onSortie(),
    });
    sortie.setEnabled(state.sortieEnabled);
    const sweep = new Button(scene, dungeonActionButtonX(1), y, {
      width, height, label: t("dungeon.sweep"),
      cost: { icon: "currency-stamina", amount: state.sweepCost, affordable: state.sweepAffordable },
      onClick: () => this.handlers.onSweep(),
    });
    sweep.setEnabled(state.sweepEnabled);
    this.layer.add([sortie, sweep]);
  }
}
