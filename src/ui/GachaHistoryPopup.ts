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
import {
  gachaHistoryEntryTint, gachaHistoryPickupRelicId, gachaHistorySectionOfBanner, gachaHistorySummary, type GachaHistorySummary, type GachaHistoryTint,
} from "./gachaHistorySections";
import type { Banner, GachaPityState } from "../core/gacha";

/**
 * 연구 기록 — 확률 정보 버튼 바로 아래 버튼이 여는 창.
 *
 * 모든 뽑기의 기록이 **한 목록에 최신 묶음부터** 쌓이고, 묶음마다 그 뽑기의 결(색)·이름·픽업 얼굴로 갈린다
 * (`gachaHistorySections.ts`). 뽑기가 늘어도 탭이 늘지 않게 갈래 탭을 두지 않는다(응태, 2026-11-15). 머리 판은
 * 지금 연구소에서 보고 있던 뽑기의 천장을 말한다. 묶음 머리줄이 언제·어느 배너·몇 회·무엇을 치렀고 그 직후 천장이
 * 몇이었는지를, 그 아래 칸 줄이 추첨 순서대로 무엇이 나왔는지를 등급 색으로 말한다. 기록은 서버가 연구를
 * 확정한 저장에 함께 남긴 값(`session.gachaHistory`)을 읽기만 한다 — 이 창에는 지우거나 고치는 조작이 없다.
 */
export interface GachaHistoryContext {
  scene: Phaser.Scene;
  popups: PopupLayer;
  history: GachaHistoryState | undefined;
  /** 천장 그룹마다의 지금 값 — 탭 머리 판이 읽는다. */
  pityByGroup: Readonly<Record<string, GachaPityState>>;
  /** 지금 연구소에서 보고 있던 배너 — 머리 판이 그 뽑기의 천장을 말한다. */
  currentBannerId: string;
}

const RELIC_BY_ID = new Map(RELICS.map((relic) => [relic.id, relic]));

function slotTier(slot: GachaHistorySlot): RateTier {
  if (slot.kind === "currency") return "GRAY";
  return RELIC_BY_ID.get(slot.relicId)?.rarity ?? "R";
}

export function openGachaHistory({ scene, popups, history, pityByGroup, currentBannerId }: GachaHistoryContext): void {
  const L = GACHA_HISTORY;
  const banners = researchBanners(true);
  const entries = gachaHistoryNewestFirst(history);
  const section = gachaHistorySectionOfBanner(currentBannerId, banners);

  popups.open({ width: L.width, height: L.height, title: t("lab.history.title"), y: L.screenTop + L.height / 2, backButton: true, dim: true, closeOnBackdrop: true }, (body) => {
    const left = -L.width / 2 + L.padding;
    const inner = L.width - L.padding * 2;
    body.add(scene.add.text(left, -L.height / 2 + L.captionY, t("lab.history.caption", { count: gachaHistorySlotCount(history), limit: GACHA_HISTORY_SLOT_LIMIT }),
      textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    body.add(addSummaryCard(scene, inner, gachaHistoryEntryTitle(currentBannerId, banners), gachaHistoryEntryTint(currentBannerId, banners), gachaHistorySummary(section, banners, pityByGroup)));
    addHistoryList(scene, body, inner, entries, banners, pityByGroup);
  });
}

/**
 * 머리 판 — 지금 연구소에서 보고 있던 뽑기의 천장. `플레샤 픽업` · `SSR 확정까지 37회` · `천장 카운트 83 / 120` /
 * 픽업 확정 · 이월 안내. 그 뽑기의 결로 물들어 아래 목록의 같은 색 묶음과 이어진다.
 */
function addSummaryCard(scene: Phaser.Scene, width: number, name: string, tint: GachaHistoryTint, summary: GachaHistorySummary): Phaser.GameObjects.Container {
  const L = GACHA_HISTORY;
  const S = L.summary;
  const node = scene.add.container(0, -L.height / 2 + S.top + S.height / 2);
  const shape = chipPoints(width, S.height, { bevel: { topLeft: 22, bottomRight: 22 } });
  node.add(drawLayer(scene, 0, 0, shape, { fill: tint.fill, alpha: 0.32, edge: tint.accent, edgeAlpha: 0.9 }));
  node.add(drawLayer(scene, 0, 0, shape, { fill: 0x0b1118, alpha: HOLO.glass }));

  const left = -width / 2 + 34;
  const right = width / 2 - 34;
  const notes: string[] = [];
  if (summary.pickupNext) notes.push(t("lab.pity.pickupNext"));
  if (summary.carriesOver) notes.push(t("lab.history.carryover"));
  // 덧붙일 줄이 없으면 수 한 줄이 판 가운데에 선다 — 위에 붙여 두면 아래 절반이 빈 판으로 읽힌다.
  const topY = notes.length > 0 ? -2 : 18;
  const title = scene.add.text(left, -S.height / 2 + 34, name, textStyle({ role: "display", size: S.nameSize, color: tint.accentText })).setOrigin(0, 0.5);
  shrinkTextToWidth(title, right - left - 260);
  node.add(title);
  const label = scene.add.text(left, topY, t("lab.pity.label"), textStyle({ role: "emphasis", size: S.unitSize, color: COLOR.inkDim })).setOrigin(0, 0.5);
  node.add(label);
  const value = scene.add.text(label.x + label.width + 16, topY + 2, String(summary.left), textStyle({ role: "display", size: S.leftSize, color: tint.accentText }))
    .setOrigin(0, 0.5).setStroke("#000000", 6).setShadow(0, 3, "#000000", 4, false, true);
  node.add(value);
  node.add(scene.add.text(value.x + value.width + 8, topY + 4, t("lab.pity.unit"), textStyle({ role: "emphasis", size: S.unitSize, color: COLOR.ink })).setOrigin(0, 0.5));

  const count = scene.add.text(right, -S.height / 2 + 34, t("lab.history.count", { count: summary.count, total: summary.total }), textStyle({ role: "emphasis", size: S.lineSize, color: COLOR.inkDim })).setOrigin(1, 0.5);
  node.add(count);

  if (notes.length > 0) {
    const line = scene.add.text(left, S.height / 2 - 38, notes.join("  ·  "), textStyle({ role: "body", size: S.lineSize, color: summary.pickupNext ? tint.accentText : COLOR.inkDim })).setOrigin(0, 0.5);
    squeezeTextToWidth(line, right - left);
    node.add(line);
  }
  return node;
}

/** 흐르는 목록 — 모든 뽑기의 묶음이 최신부터 한 줄로 쌓인다. 어느 뽑기인지는 묶음 머리줄의 색·이름·얼굴이 말한다. */
function addHistoryList(scene: Phaser.Scene, page: Phaser.GameObjects.Container, inner: number, entries: GachaHistoryEntry[], banners: readonly Banner[], pityByGroup: Readonly<Record<string, GachaPityState>>): void {
  const L = GACHA_HISTORY;
  const layout = gachaHistoryRows(entries.map((entry) => entry.slots.length));
  const viewHeight = gachaHistoryViewportHeight();
  // 흐르는 창 — 마스크와 입력면은 흐르지 않는 틀을 따라가므로 판이 떠오르는 동안에도 어긋나지 않는다.
  const frame = scene.add.container(0, -L.height / 2 + L.viewportTop);
  page.add(frame);
  const half = inner / 2 + 12;
  const content = scene.add.container(0, 0);
  frame.add(content);
  content.setMask(shapeClipMask(scene, frame, [-half, 0, half, 0, half, viewHeight, -half, viewHeight]));

  const rows: { node: Phaser.GameObjects.Container; row: GachaHistoryRow }[] = [];
  for (const row of layout.rows) {
    const entry = entries[row.group];
    const node = row.kind === "header" ? addHeaderRow(scene, inner, entry, banners, pityByGroup) : addSlotRow(scene, inner, entry.slots[row.slot ?? 0]);
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
}

/** 뽑기 이름 — 픽업은 `디안 픽업`, 나머지는 배너 이름, 끝나 사라진 배너는 「종료된 연구」. */
function gachaHistoryEntryTitle(bannerId: string, banners: readonly Banner[]): string {
  const pickupId = gachaHistoryPickupRelicId(bannerId, banners);
  const pickup = pickupId ? RELIC_BY_ID.get(pickupId) : undefined;
  if (pickup) return t("lab.history.pickupName", { name: pickup.name });
  return banners.find(({ id }) => id === bannerId)?.name ?? t("lab.history.unknownBanner");
}

/**
 * 묶음 머리줄 — `디안 픽업 ··· 2026.11.11 17:59` / `10회 연구 · 호박석 ×10 · 천장 카운트 23 / 120`.
 * 천장 카운트는 그 연구 직후 **그 뽑기의** 값이다 — 분모가 그 뽑기의 천장이라 어느 천장의 수인지 함께 읽힌다.
 * 그 배너의 모집판 결이 왼쪽 띠·윗변 선·제목 색으로 서고, 픽업 배너는 픽업 렐릭의 얼굴이 앞에 선다 —
 * 같은 한정 픽업 탭 안에서도 어느 픽업에서 뽑았는지가 색과 얼굴로 먼저 읽힌다.
 */
function addHeaderRow(scene: Phaser.Scene, width: number, entry: GachaHistoryEntry, banners: readonly Banner[], pityByGroup: Readonly<Record<string, GachaPityState>>): Phaser.GameObjects.Container {
  const L = GACHA_HISTORY.header;
  const node = scene.add.container(0, 0);
  const tint = gachaHistoryEntryTint(entry.bannerId, banners);
  const shape = chipPoints(width, L.height, { bevel: { topLeft: 18, bottomRight: 18 } });
  node.add(drawLayer(scene, 0, 0, shape, { fill: tint.fill, alpha: 0.26, edge: tint.accent, edgeAlpha: 0.85 }));
  node.add(drawLayer(scene, 0, 0, shape, { fill: 0x121a24, alpha: HOLO.glass }));
  node.add(scene.add.rectangle(-width / 2 + 14 + L.band / 2, 4, L.band, L.height - 30, tint.accent, 0.95));

  let left = -width / 2 + 34;
  const right = width / 2 - 28;
  const pickupId = gachaHistoryPickupRelicId(entry.bannerId, banners);
  const pickup = pickupId ? RELIC_BY_ID.get(pickupId) : undefined;
  if (pickup) {
    node.add(new FaceFrame(scene, left + L.face / 2, 0, { portraitAssetId: pickup.portraitAssetId, size: L.face, color: tint.accent }));
    left += L.face + 18;
  }
  const date = scene.add.text(right, -L.height / 4 + 2, formatGachaHistoryTime(entry.at), textStyle({ role: "emphasis", size: L.dateSize, color: COLOR.inkDim })).setOrigin(1, 0.5);
  node.add(date);
  const bannerName = gachaHistoryEntryTitle(entry.bannerId, banners);
  const title = scene.add.text(left, -L.height / 4 + 2, bannerName, textStyle({ role: "display", size: L.titleSize, color: tint.accentText })).setOrigin(0, 0.5);
  shrinkTextToWidth(title, right - date.width - 24 - left);
  node.add(title);

  const cost = Object.entries(entry.cost).map(([key, amount]) => t("lab.history.amount", { currency: t(`currency.${key}` as "currency.gems"), amount: amount.toLocaleString() }));
  const sub = [t(entry.count === 10 ? "lab.pull.ten" : "lab.pull.one"), ...cost, t("lab.history.count", { count: entry.pity, total: gachaHistorySummary(gachaHistorySectionOfBanner(entry.bannerId, banners), banners, pityByGroup).total })].join("  ·  ");
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
