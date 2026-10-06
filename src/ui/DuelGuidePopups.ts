import Phaser from "phaser";
import { t } from "../i18n";
import { DUEL_TIERS, type DuelTierId } from "../core/duelArena";
import type { DuelHistoryEntry } from "../core/duelState";
import { addDuelTierEmblem } from "./DuelTierEmblem";
import { DUEL_TIER_COLOR } from "./duelLayout";
import { chipPoints, drawLayer, HOLO } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

const ROW = { width: 820, height: 104, gap: 12 } as const;

/**
 * 티어 안내 — 여덟 티어의 시작 점수, 가려지는 칸, 시즌 보상. 지금 티어는 한 뼘 밝다.
 *
 * 값은 전부 `DUEL_TIERS` 한 표에서 읽는다. 화면이 수를 따로 적지 않는다.
 */
export function openDuelTierGuide(scene: Phaser.Scene, popups: PopupLayer, current: DuelTierId): void {
  const top = 150;
  const height = top + DUEL_TIERS.length * (ROW.height + ROW.gap) + 60;
  popups.open({ width: 920, height, title: t("duel.link.tiers"), dim: true, closeOnBackdrop: true }, (body) => {
    DUEL_TIERS.forEach((tier, index) => {
      const y = -height / 2 + top + ROW.height / 2 + index * (ROW.height + ROW.gap);
      const tone = DUEL_TIER_COLOR[tier.id];
      const mine = tier.id === current;
      body.add(drawLayer(scene, 0, y, chipPoints(ROW.width, ROW.height), { fill: mine ? 0x263844 : 0x171d25, alpha: HOLO.glass, edge: tone.fill, edgeAlpha: mine ? 0.9 : 0.35 }));
      addDuelTierEmblem(scene, body, -ROW.width / 2 + 62, y, 76, tier.id);
      body.add(scene.add.text(-ROW.width / 2 + 120, y - 20, t(`duel.tier.${tier.id}`), textStyle({ role: "display", size: 30, color: tone.text })).setOrigin(0, 0.5));
      body.add(scene.add.text(-ROW.width / 2 + 120, y + 22, t("duel.tierGuide.floor", { score: tier.floor.toLocaleString() }), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
      const blind = tier.blind > 0 ? t("duel.tierGuide.blind", { count: tier.blind }) : t("duel.tierGuide.noBlind");
      body.add(scene.add.text(40, y - 20, blind, textStyle({ role: "emphasis", size: 22, color: tier.blind > 0 ? COLOR.dangerText : COLOR.inkDim })).setOrigin(0, 0.5));
      body.add(scene.add.text(40, y + 22, t("duel.tierGuide.reward", { emblem: tier.seasonReward.duelEmblem.toLocaleString(), gems: tier.seasonReward.gems.toLocaleString() }), textStyle({ role: "body", size: 22, color: COLOR.ink })).setOrigin(0, 0.5));
    });
  });
}

/** 최근 전적 — 상대·점수·결과·바뀐 점수. 비었으면 한 줄만 선다. */
export function openDuelHistoryPopup(scene: Phaser.Scene, popups: PopupLayer, history: readonly DuelHistoryEntry[]): void {
  const top = 150;
  const rows = Math.max(1, history.length);
  const height = top + rows * (ROW.height + ROW.gap) + 60;
  popups.open({ width: 920, height, title: t("duel.link.history"), dim: true, closeOnBackdrop: true }, (body) => {
    if (history.length === 0) {
      body.add(scene.add.text(0, -height / 2 + top + ROW.height / 2, t("duel.history.empty"), textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
      return;
    }
    history.forEach((entry, index) => {
      const y = -height / 2 + top + ROW.height / 2 + index * (ROW.height + ROW.gap);
      const color = entry.won ? COLOR.accent : COLOR.danger;
      body.add(drawLayer(scene, 0, y, chipPoints(ROW.width, ROW.height), { fill: 0x171d25, alpha: HOLO.glass, edge: color, edgeAlpha: 0.6 }));
      body.add(scene.add.text(-ROW.width / 2 + 40, y, entry.won ? t("duel.history.win") : t("duel.history.loss"), textStyle({ role: "display", size: 32, color: entry.won ? COLOR.accentText : COLOR.dangerText })).setOrigin(0, 0.5));
      body.add(scene.add.text(-ROW.width / 2 + 150, y - 18, entry.opponentName, textStyle({ role: "emphasis", size: 26, color: COLOR.ink })).setOrigin(0, 0.5));
      body.add(scene.add.text(-ROW.width / 2 + 150, y + 22, t("duel.score", { score: entry.opponentScore.toLocaleString() }), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
      const delta = `${entry.delta > 0 ? "+" : ""}${entry.delta}`;
      body.add(scene.add.text(ROW.width / 2 - 40, y, delta, textStyle({ role: "display", size: 32, color: entry.delta >= 0 ? COLOR.accentText : COLOR.dangerText })).setOrigin(1, 0.5));
    });
  });
}
