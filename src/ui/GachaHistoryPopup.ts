import Phaser from "phaser";
import { t } from "../i18n";
import { GACHA_HISTORY_SLOT_LIMIT, gachaHistoryNewestFirst, gachaHistorySlotCount, type GachaHistoryEntry, type GachaHistorySlot, type GachaHistoryState } from "../core/gachaHistory";
import type { RateTier } from "../core/gachaRateTable";
import { researchBanners } from "../data/banners";
import { RELICS } from "../data/relics";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { FaceFrame } from "./FaceFrame";
import { tierColor, tierLabel } from "./GachaRatesPopup";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { shapeClipMask } from "./popupArt";
import { RARITY_TONE } from "./rarityMark";
import { addScrollHint } from "./ScrollHint";
import { shrinkTextToWidth, squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { formatGachaHistoryTime, GACHA_HISTORY, gachaHistoryRows, gachaHistoryViewportHeight, type GachaHistoryRow } from "./gachaHistoryLayout";

/**
 * 연구 기록 — 확률 정보 버튼 바로 아래 버튼이 여는 창.
 *
 * 최근 연구가 **최신 묶음부터** 흐른다. 묶음 머리줄이 언제·어느 배너·몇 회·무엇을 치렀고 그 직후 천장이
 * 몇이었는지를, 그 아래 칸 줄이 추첨 순서대로 무엇이 나왔는지를 등급 색으로 말한다. 기록은 서버가 연구를
 * 확정한 저장에 함께 남긴 값(`session.gachaHistory`)을 읽기만 한다 — 이 창에는 지우거나 고치는 조작이 없다.
 */
export interface GachaHistoryContext {
  scene: Phaser.Scene;
  popups: PopupLayer;
  history: GachaHistoryState | undefined;
}

const RELIC_BY_ID = new Map(RELICS.map((relic) => [relic.id, relic]));

function slotTier(slot: GachaHistorySlot): RateTier {
  if (slot.kind === "currency") return "GRAY";
  return RELIC_BY_ID.get(slot.relicId)?.rarity ?? "R";
}

export function openGachaHistory({ scene, popups, history }: GachaHistoryContext): void {
  const L = GACHA_HISTORY;
  const entries = gachaHistoryNewestFirst(history);
  const layout = gachaHistoryRows(entries.map((entry) => entry.slots.length));
  const viewHeight = gachaHistoryViewportHeight();

  popups.open({ width: L.width, height: L.height, title: t("lab.history.title"), y: L.screenTop + L.height / 2, backButton: true, dim: true, closeOnBackdrop: true }, (body) => {
    const left = -L.width / 2 + L.padding;
    const inner = L.width - L.padding * 2;
    body.add(scene.add.text(left, -L.height / 2 + L.captionY, t("lab.history.caption", { count: gachaHistorySlotCount(history), limit: GACHA_HISTORY_SLOT_LIMIT }),
      textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));

    // 흐르는 창 — 마스크와 입력면은 흐르지 않는 틀을 따라가므로 판이 떠오르는 동안에도 어긋나지 않는다.
    const frame = scene.add.container(0, -L.height / 2 + L.viewportTop);
    body.add(frame);
    const half = inner / 2 + 12;
    const content = scene.add.container(0, 0);
    frame.add(content);
    content.setMask(shapeClipMask(scene, frame, [-half, 0, half, 0, half, viewHeight, -half, viewHeight]));

    const rows: { node: Phaser.GameObjects.Container; row: GachaHistoryRow }[] = [];
    for (const row of layout.rows) {
      const entry = entries[row.group];
      const node = row.kind === "header" ? addHeaderRow(scene, inner, entry) : addSlotRow(scene, inner, entry.slots[row.slot ?? 0]);
      node.setY(row.y);
      content.add(node);
      rows.push({ node, row });
    }

    let scroll = 0;
    const minScroll = Math.min(0, viewHeight - layout.height);
    const apply = (value: number): void => {
      if (!content.active) return;
      scroll = Phaser.Math.Clamp(value, minScroll, 0);
      content.y = scroll;
      // 창 밖의 줄은 감춘다 — 마스크는 그림만 자르고, 백 줄을 늘 그리면 그만큼 무겁다.
      for (const { node, row } of rows) {
        const top = row.y + scroll - row.height / 2;
        node.setVisible(top + row.height > 0 && top < viewHeight);
      }
    };
    apply(0);
    if (layout.height <= viewHeight) return;

    const clip = (): ClipRect => {
      const matrix = frame.getWorldTransformMatrix();
      const scale = matrix.scaleY || 1;
      return { left: matrix.tx - half * scale, right: matrix.tx + half * scale, top: matrix.ty, bottom: matrix.ty + viewHeight * scale };
    };
    const drag = addClippedHit(scene, frame, 0, viewHeight / 2, half * 2, viewHeight, clip, { useHandCursor: false });
    scene.input.setDraggable(drag);
    let lastY = 0;
    drag.on("dragstart", (pointer: Phaser.Input.Pointer) => { lastY = pointer.y; });
    drag.on("drag", (pointer: Phaser.Input.Pointer) => {
      const scale = frame.getWorldTransformMatrix().scaleY || 1;
      apply(scroll + (pointer.y - lastY) / scale);
      lastY = pointer.y;
    });
    drag.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => apply(scroll - dy * 0.65));
    addScrollHint(scene, frame, { x: 0, y: viewHeight / 2, width: half * 2, height: viewHeight, owner: content, read: () => ({ offset: scroll, min: minScroll }) });
  });
}

/** 묶음 머리줄 — `배너 이름 ··· 2026.11.11 17:59` / `10회 연구 · 화석 ×10 · 천장 23`. */
function addHeaderRow(scene: Phaser.Scene, width: number, entry: GachaHistoryEntry): Phaser.GameObjects.Container {
  const L = GACHA_HISTORY.header;
  const node = scene.add.container(0, 0);
  const shape = chipPoints(width, L.height, { bevel: { topLeft: 18, bottomRight: 18 } });
  node.add(drawLayer(scene, 0, 0, shape, { fill: 0x121a24, alpha: HOLO.glass + 0.25, edge: COLOR.accent, edgeAlpha: 0.55 }));

  const left = -width / 2 + 28;
  const right = width / 2 - 28;
  const date = scene.add.text(right, -L.height / 4 + 2, formatGachaHistoryTime(entry.at), textStyle({ role: "emphasis", size: L.dateSize, color: COLOR.inkDim })).setOrigin(1, 0.5);
  node.add(date);
  const bannerName = researchBanners(true).find((banner) => banner.id === entry.bannerId)?.name ?? t("lab.history.unknownBanner");
  const title = scene.add.text(left, -L.height / 4 + 2, bannerName, textStyle({ role: "display", size: L.titleSize, color: COLOR.ink })).setOrigin(0, 0.5);
  shrinkTextToWidth(title, right - date.width - 24 - left);
  node.add(title);

  const cost = Object.entries(entry.cost).map(([key, amount]) => t("lab.history.amount", { currency: t(`currency.${key}` as "currency.gems"), amount: amount.toLocaleString() }));
  const sub = [t(entry.count === 10 ? "lab.pull.ten" : "lab.pull.one"), ...cost, t("lab.history.pity", { count: entry.pity })].join("  ·  ");
  const subText = scene.add.text(left, L.height / 4 - 2, sub, textStyle({ role: "body", size: L.subSize, color: COLOR.inkDim })).setOrigin(0, 0.5);
  squeezeTextToWidth(subText, right - left);
  node.add(subText);
  return node;
}

/** 칸 줄 — 액자 · 이름(+ NEW) ··· 등급. 등급 색이 이름과 등급 글자에 함께 든다. */
function addSlotRow(scene: Phaser.Scene, width: number, slot: GachaHistorySlot): Phaser.GameObjects.Container {
  const L = GACHA_HISTORY.slot;
  const node = scene.add.container(0, 0);
  const tier = slotTier(slot);
  const { ink, tone } = tierColor(tier);
  const left = -width / 2 + L.indent;
  const right = width / 2 - 28;
  // 등급 색을 띤 얇은 줄 — 같은 묶음의 칸들이 머리줄 아래로 이어지는 것을 왼쪽 띠가 묶는다.
  node.add(scene.add.rectangle(left - 12, 0, 6, L.height - 10, tone, tier === "GRAY" ? 0.35 : 0.85));

  const iconX = left + 12 + L.icon / 2;
  let name: string;
  if (slot.kind === "relic") {
    const def = RELIC_BY_ID.get(slot.relicId);
    name = def?.name ?? "???";
    if (def) node.add(new FaceFrame(scene, iconX, 0, { portraitAssetId: def.portraitAssetId, size: L.icon, color: RARITY_TONE[def.rarity].chip }));
  } else {
    name = t("lab.history.amount", { currency: t(`currency.${slot.currency}`), amount: slot.amount.toLocaleString() });
    addFramedIcon(scene, node, iconX, 0, L.icon, CURRENCY_ICON_BY_WALLET[slot.currency]);
  }

  const tierText = scene.add.text(right, 0, tierLabel(tier), textStyle({ role: "display", size: L.tierSize, color: ink })).setOrigin(1, 0.5).setShadow(0, 3, "#000000", 4, false, true);
  node.add(tierText);
  const nameX = iconX + L.icon / 2 + 20;
  const nameText = scene.add.text(nameX, 0, name, textStyle({ role: "emphasis", size: L.nameSize, color: tier === "GRAY" ? COLOR.ink : ink })).setOrigin(0, 0.5);
  node.add(nameText);
  const room = tierText.x - tierText.width - nameX - 24;
  if (slot.kind === "relic" && slot.isNew) {
    const tag = scene.add.text(0, 0, "NEW", textStyle({ role: "display", size: L.tagSize, color: COLOR.accentText })).setOrigin(0, 0.5).setStroke("#3b2408", 6).setAngle(-4);
    shrinkTextToWidth(nameText, Math.max(80, room - tag.width - 14));
    tag.setX(nameX + nameText.displayWidth + 14);
    node.add(tag);
  } else {
    shrinkTextToWidth(nameText, room);
  }
  return node;
}
