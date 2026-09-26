import Phaser from "phaser";
import { t } from "../i18n";
import type { Banner, GachaPityState } from "../core/gacha";
import { formatRatePercent, gachaRateTable, type RateEntry, type RateTier, type RateTierRow } from "../core/gachaRateTable";
import { getRelic } from "../data/relics";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { FaceFrame } from "./FaceFrame";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { RARITY_TONE } from "./rarityMark";
import { addSectionTitle } from "./SectionTitle";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { GACHA_RATES, gachaRatesPopupHeight, gachaRatesRowCount, gachaRatesSlots } from "./gachaRatesLayout";

/**
 * 연구 확률 정보 — **등급 네 줄을 눌러 펼치는 표**.
 *
 * 처음에는 SSR·SR·R·잡화 네 줄이 등급 확률만 말하고, 한 줄을 누르면 그 안의 개체(얼굴 액자)와
 * 재화(아이템 액자)가 **제 확률**과 함께 펼쳐진다. 픽업 개체는 맨 위에 `Pick Up!`을 달고 선다.
 * 한 번에 한 등급만 펼친다 — 둘을 함께 펼치면 가장 큰 풀 둘이 겹쳐 세로 화면을 넘는다.
 *
 * 펼치고 접을 때는 판을 같은 제목으로 **갈아 끼운다**(`PopupLayer`가 연출 없이 세운다). 창 높이가
 * 줄 수에서 나오므로 자라고 줄어드는 판을 제자리에서 다시 그리는 것보다 이 길이 곧다.
 *
 * 숫자는 전부 `gachaRateTable`이 배너 정의에서 셈한 값이다. 천장·10연 보장·픽업 확정은 표가
 * 아니라 아래 **규칙** 글이 말한다 — 1회 확률을 바꾸는 조건이라 표에 섞으면 어느 수가 기준인지 흐려진다.
 */
export interface GachaRatesContext {
  scene: Phaser.Scene;
  popups: PopupLayer;
  banner: Banner;
  pity: GachaPityState;
}

/** 등급 줄의 이름과 색. 렐릭 등급은 카드 바탕과 같은 색이고, 잡화만 잿빛이다. */
function tierLabel(tier: RateTier): string {
  return tier === "GRAY" ? t("lab.rates.tier.gray") : tier;
}

function tierColor(tier: RateTier): { ink: string; tone: number } {
  if (tier === "GRAY") return { ink: "#c9d0d8", tone: 0x8a939e };
  return { ink: RARITY_TONE[tier].halo, tone: RARITY_TONE[tier].chip };
}

export function openGachaRates(context: GachaRatesContext, expanded: RateTier | null = "SSR"): void {
  const { scene, popups, banner } = context;
  const L = GACHA_RATES;
  const table = gachaRateTable(banner);
  const open = table.find((row) => row.tier === expanded && row.entries.length > 0);
  const inner = L.width - L.padding * 2;

  // 규칙 글은 언어마다 줄 수가 달라 먼저 재고, 그 높이에서 창 높이를 구한다.
  const notes = scene.add.text(0, 0, rulesText(context), textStyle({ role: "body", size: L.notesSize, color: COLOR.inkDim, lineSpacing: 10, wrap: inner }))
    .setOrigin(0, 0);
  const height = Math.min(L.maxHeight, gachaRatesPopupHeight(table.length, open ? gachaRatesRowCount(pickupFlags(open)) : 0, notes.height));

  popups.open({ width: L.width, height, title: t("lab.rates"), y: L.screenTop + height / 2, backButton: true, dim: true, closeOnBackdrop: true }, (body, close) => {
    const left = -L.width / 2 + L.padding;
    let y = -height / 2 + L.topRoom;
    body.add(scene.add.text(left, y, t("lab.rates.basis", { banner: banner.name }), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    y += L.captionRoom;

    const reopen = (tier: RateTier | null): void => {
      close();
      openGachaRates(context, tier);
    };
    for (const row of table) {
      addTierRow(scene, body, 0, y + L.tierHeight / 2, inner, row, open?.tier === row.tier, () => reopen(open?.tier === row.tier ? null : row.tier));
      y += L.tierStep;
      if (open?.tier !== row.tier) continue;
      y += L.entryPad;
      const top = y - (L.tierStep - L.tierHeight) / 2;
      const span = inner - L.entryIndent;
      const half = (span - L.columnGap) / 2;
      const slots = gachaRatesSlots(pickupFlags(row));
      for (const slot of slots) {
        const x = left + L.entryIndent + (slot.column === 1 ? half + L.columnGap : 0);
        addEntryRow(scene, body, x, top + slot.row * L.entryStep + L.entryStep / 2, slot.span === 2 ? span : half, row.entries[slot.index], row.tier);
      }
      y += gachaRatesRowCount(pickupFlags(row)) * L.entryStep + L.entryPad;
    }

    y += L.notesGap - (L.tierStep - L.tierHeight);
    addSectionTitle(scene, left, y, t("lab.rates.rules"), { size: 28, parent: body });
    y += L.notesTitleRoom;
    body.add(notes.setPosition(left, y));
  });
}

function pickupFlags(row: RateTierRow): { pickup: boolean }[] {
  return row.entries.map((entry) => ({ pickup: entry.kind === "relic" && entry.pickup }));
}

/** 규칙 글 — 지금 계정의 천장 상태와 이 배너가 갖는 보장만 적는다. */
function rulesText({ banner, pity }: GachaRatesContext): string {
  const hasPickup = Object.values(banner.pickupRelicIds).some((ids) => (ids?.length ?? 0) > 0);
  return [
    ...(banner.pullLimit !== undefined ? [t("lab.policy.limit", { limit: banner.pullLimit })] : []),
    t("lab.policy.pity", { since: pity.pullsSinceSsr, left: Math.max(0, banner.highestRarityGuarantee - pity.pullsSinceSsr) }),
    ...(hasPickup ? [
      t("lab.policy.pickupRate", { percent: formatRatePercent(banner.pickupRate) }),
      t("lab.policy.pickup", { state: t(pity.pickupGuaranteed ? "lab.policy.pickupOn" : "lab.policy.pickupOff") }),
    ] : []),
    t("lab.policy.tenGuarantee"),
    t("lab.policy.duplicate"),
    t("lab.policy.duplicateMax"),
  ].map((line) => `· ${line}`).join("\n");
}

/** 등급 한 줄 — `SSR • • • 1% ▾`. 줄 전체가 눌린다. */
function addTierRow(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  row: RateTierRow,
  isOpen: boolean,
  onToggle: () => void,
): void {
  const L = GACHA_RATES;
  const { ink, tone } = tierColor(row.tier);
  const holder = scene.add.container(x, y);
  parent.add(holder);
  const shape = chipPoints(width, L.tierHeight, { bevel: { topLeft: 18, bottomRight: 18 } });
  holder.add(drawLayer(scene, 0, 0, shape, { fill: isOpen ? 0x1a2230 : 0x121821, alpha: HOLO.glass + 0.2, edge: tone, edgeAlpha: isOpen ? 0.95 : 0.55 }));

  const left = -width / 2 + 30;
  const right = width / 2 - 30;
  const label = scene.add.text(left, 0, tierLabel(row.tier), textStyle({ role: "display", size: L.tierLabelSize, color: ink }))
    .setOrigin(0, 0.5).setShadow(0, 3, "#000000", 4, false, true);
  shrinkTextToWidth(label, 200);
  holder.add(label);

  const canExpand = row.entries.length > 0;
  const caret = canExpand ? drawGlyph(scene, "caret-down", right - 12, 0, 26, 0xf2f0ec, 0.85) : undefined;
  if (caret) holder.add(caret.setAngle(isOpen ? 180 : 0));
  const percent = scene.add.text(right - (canExpand ? 44 : 0), 0, t("lab.rates.percent", { percent: formatRatePercent(row.rate) }),
    textStyle({ role: "display", size: L.tierPercentSize, color: COLOR.ink })).setOrigin(1, 0.5).setShadow(0, 3, "#000000", 4, false, true);
  holder.add(percent);

  // 이름과 확률을 잇는 점줄 — 둘이 한 줄의 양 끝이라는 것을 눈이 따라가게 한다.
  const dotsFrom = left + label.displayWidth + 26;
  const dotsTo = percent.x - percent.width - 26;
  const dots = scene.add.graphics();
  dots.fillStyle(tone, 0.8);
  for (let dx = dotsFrom; dx <= dotsTo; dx += 22) {
    dots.fillPoints([new Phaser.Geom.Point(dx, -4), new Phaser.Geom.Point(dx + 4, 0), new Phaser.Geom.Point(dx, 4), new Phaser.Geom.Point(dx - 4, 0)], true);
  }
  holder.add(dots);

  if (!canExpand) return;
  const hit = scene.add.rectangle(0, 0, width, L.tierHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(holder));
  hit.on("pointerout", () => pressOut(holder, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(holder); onToggle(); });
  holder.add(hit);
}

/** 세부 한 줄 — 액자 · 이름(+ Pick Up!) · 확률. */
function addEntryRow(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  left: number,
  y: number,
  width: number,
  entry: RateEntry,
  tier: RateTier,
): void {
  const L = GACHA_RATES;
  const iconX = left + L.entryIcon / 2;
  const nameX = left + L.entryIcon + 22;
  const right = left + width - 12;
  let name: string;
  let sub: string | undefined;
  if (entry.kind === "relic") {
    const def = getRelic(entry.relicId);
    name = def.name;
    const face = new FaceFrame(scene, iconX, y, { portraitAssetId: def.portraitAssetId, size: L.entryIcon, color: tier === "GRAY" ? COLOR.accent : RARITY_TONE[tier].chip });
    parent.add(face);
  } else {
    name = t(`currency.${entry.reward}`);
    sub = t("lab.rates.range", { min: entry.min.toLocaleString(), max: entry.max.toLocaleString() });
    addFramedIcon(scene, parent, iconX, y, L.entryIcon, CURRENCY_ICON_BY_WALLET[entry.reward]);
  }

  const percent = scene.add.text(right, y, t("lab.rates.percent", { percent: formatRatePercent(entry.rate) }),
    textStyle({ role: "emphasis", size: L.entryPercentSize, color: entry.kind === "relic" && entry.pickup ? COLOR.accentText : COLOR.ink })).setOrigin(1, 0.5);
  parent.add(percent);
  const nameText = scene.add.text(nameX, sub ? y - 14 : y, name, textStyle({ role: "emphasis", size: L.entryNameSize, color: COLOR.ink })).setOrigin(0, 0.5);
  parent.add(nameText);
  const room = percent.x - percent.width - nameX - 24;
  if (entry.kind === "relic" && entry.pickup) {
    const tag = scene.add.text(0, y, t("lab.rates.pickup"), textStyle({ role: "display", size: 22, color: COLOR.accentText }))
      .setOrigin(0, 0.5).setStroke("#3b2408", 6).setAngle(-4);
    shrinkTextToWidth(nameText, Math.max(80, room - tag.width - 14));
    tag.setX(nameX + nameText.displayWidth + 14);
    parent.add(tag);
  } else {
    shrinkTextToWidth(nameText, room);
  }
  if (sub) parent.add(scene.add.text(nameX, y + 18, sub, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0, 0.5));
}
