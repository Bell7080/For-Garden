import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { BASE_WIDTH } from "../config/gameConfig";
import { duelHistoryAge, type DuelHistoryEntry } from "../core/duelState";
import { getRelic } from "../data/relics";
import { addClippedHit } from "./clippedHit";
import { addDuelTierEmblem } from "./DuelTierEmblem";
import { DUEL_SCREEN, DUEL_TIER_COLOR, duelHistoryMinScroll, duelHistoryRowY } from "./duelLayout";
import { FaceFrame } from "./FaceFrame";
import { chipPoints, drawLayer, HOLO, slantedRect } from "./holo";
import { addSectionTitle } from "./SectionTitle";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

const H = DUEL_SCREEN.history;
const ROW_WIDTH = DUEL_SCREEN.width;
/** 줄 안의 자리 — 줄 가운데가 0이다. */
const ROW = { resultX: -400, faceX: -268, nameX: -204, nameRoom: 290, unitX: 128, unitGap: 74, deltaX: 404, deltaWidth: 128, deltaHeight: 64 } as const;

const AGE_KEY: Record<Exclude<ReturnType<typeof duelHistoryAge>["unit"], "now">, TextKey> = {
  minute: "duel.history.ago.minute", hour: "duel.history.ago.hour", day: "duel.history.ago.day",
};

/**
 * 결투장 「전적」 탭 — 최근 판부터 한 줄씩. 줄은 **결과 → 상대(얼굴·이름·티어·덱) → 점수 변화** 순이다.
 *
 * 줄이 창보다 길면 판 안에서만 흐른다(목록을 담은 컨테이너만 움직이고 마스크는 화면 좌표에 고정).
 * 기록이 없으면 제목표만 서고 칸을 비운다 — "아직 기록이 없다"는 지금 할 일을 바꾸지 않는다.
 */
export function paintDuelHistory(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, history: readonly DuelHistoryEntry[], nowMs: number): void {
  addSectionTitle(scene, DUEL_SCREEN.side, H.titleY, t("duel.history.title"), { parent });
  if (history.length === 0) return;

  const list = scene.add.container(BASE_WIDTH / 2, H.top);
  parent.add(list);
  history.forEach((entry, index) => paintRow(scene, list, entry, duelHistoryRowY(index), nowMs));

  const minY = duelHistoryMinScroll(history.length);
  if (minY === 0) return;
  const viewport = H.bottom - H.top;
  const maskShape = scene.add.rectangle(BASE_WIDTH / 2, H.top + viewport / 2, BASE_WIDTH, viewport, 0xffffff).setVisible(false);
  list.setMask(maskShape.createGeometryMask());
  // 마스크는 그것이 자르는 목록과 같은 목숨을 산다.
  list.once(Phaser.GameObjects.Events.DESTROY, () => { list.clearMask(true); maskShape.destroy(); });
  const clip = { left: BASE_WIDTH / 2 - ROW_WIDTH / 2, right: BASE_WIDTH / 2 + ROW_WIDTH / 2, top: H.top, bottom: H.bottom };
  const hit = addClippedHit(scene, parent, BASE_WIDTH / 2, H.top + viewport / 2, ROW_WIDTH, viewport, () => clip, { useHandCursor: false });
  parent.sendToBack(hit);
  scene.input.setDraggable(hit);
  let offset = 0; let dragY = 0;
  const move = (delta: number): void => { offset = Phaser.Math.Clamp(offset + delta, minY, 0); list.y = H.top + offset; };
  hit.on("dragstart", (pointer: Phaser.Input.Pointer) => { dragY = pointer.y; });
  hit.on("drag", (pointer: Phaser.Input.Pointer) => { move(pointer.y - dragY); dragY = pointer.y; });
  hit.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => move(-dy * 0.65));
}

function paintRow(scene: Phaser.Scene, list: Phaser.GameObjects.Container, entry: DuelHistoryEntry, y: number, nowMs: number): void {
  const color = entry.won ? COLOR.accent : COLOR.danger;
  const tone = entry.opponentTierId ? DUEL_TIER_COLOR[entry.opponentTierId] : undefined;
  list.add(drawLayer(scene, 0, y, chipPoints(ROW_WIDTH, H.rowHeight), { fill: entry.won ? 0x1d2630 : 0x241a1f, alpha: HOLO.glass, edge: color, edgeAlpha: 0.6 }));

  list.add(scene.add.text(ROW.resultX, y - 22, entry.won ? t("duel.history.win") : t("duel.history.loss"), textStyle({ role: "display", size: 38, color: entry.won ? COLOR.accentText : COLOR.dangerText })).setOrigin(0.5));
  const age = duelHistoryAge(entry.at, nowMs);
  list.add(scene.add.text(ROW.resultX, y + 30, age.unit === "now" ? t("duel.history.ago.now") : t(AGE_KEY[age.unit], { value: age.value }), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0.5));

  if (entry.opponentFavoriteRelicId) {
    list.add(new FaceFrame(scene, ROW.faceX, y, { portraitAssetId: getRelic(entry.opponentFavoriteRelicId).portraitAssetId, size: H.faceSize, color: tone?.fill ?? COLOR.panelEdge }));
  }
  list.add(squeezeTextToWidth(scene.add.text(ROW.nameX, y - 40, entry.opponentName, textStyle({ role: "display", size: 30, color: COLOR.ink })).setOrigin(0, 0.5), ROW.nameRoom));
  if (entry.opponentTierId && tone) {
    addDuelTierEmblem(scene, list, ROW.nameX + 16, y + 4, 32, entry.opponentTierId);
    list.add(scene.add.text(ROW.nameX + 42, y + 4, t(`duel.tier.${entry.opponentTierId}`), textStyle({ role: "emphasis", size: 22, color: tone.text })).setOrigin(0, 0.5));
  }
  list.add(scene.add.text(ROW.nameX, y + 46, t("duel.score", { score: entry.opponentScore.toLocaleString() }), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));

  (entry.opponentUnits ?? []).forEach((unit, index) => {
    const x = ROW.unitX + index * ROW.unitGap;
    list.add(new FaceFrame(scene, x, y - 8, { portraitAssetId: getRelic(unit.relicId).portraitAssetId, size: H.unitSize, color: tone?.fill ?? COLOR.panelEdge }));
    list.add(scene.add.text(x, y + H.unitSize / 2 - 10, `LV.${unit.level}`, textStyle({ role: "emphasis", size: 18, color: COLOR.accentText })).setOrigin(0.5, 0));
  });

  const delta = `${entry.delta > 0 ? "+" : ""}${entry.delta}`;
  list.add(drawLayer(scene, ROW.deltaX, y, slantedRect(ROW.deltaWidth, ROW.deltaHeight), { fill: 0x05070a, alpha: 0.7, shadow: false }));
  list.add(scene.add.text(ROW.deltaX, y, delta, textStyle({ role: "display", size: 32, color: entry.delta >= 0 ? COLOR.accentText : COLOR.dangerText })).setOrigin(0.5));
}
