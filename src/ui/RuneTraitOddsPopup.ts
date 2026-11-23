import Phaser from "phaser";
import { t } from "../i18n";
import { runeRarityLabel } from "../core/runes";
import { formatRatePercent } from "../core/gachaRateTable";
import { RUNE_TRAIT_GRADES, RUNE_TRAIT_RULES, runeTraitPickChance, type RuneTraitGrade } from "../core/runeTraits";
import { LEGENDARY_EXCLUSIVE_SHARE, RUNE_TRAIT_DEFS, RUNE_TRAIT_POOL } from "../data/runeTraits";
import { KeywordManager } from "../managers/KeywordManager";
import { drawGlyph } from "./glyphs";
import { addOddsTip, drawTipUnderline } from "./oddsTip";
import { chipPoints, drawLayer, HOLO } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { RUNE_ACCENT } from "./runeIcons";
import { runeTraitName, runeTraitView } from "./runeTraitPresentation";
import { addSectionTitle } from "./SectionTitle";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 특성 확률 정보 — 연구 확률표(`GachaRatesPopup`)와 같은 **등급 줄을 눌러 펼치는 표**.
 *
 * 처음에는 고급·희귀·영웅·전설 네 줄이 `고급 • • • 12% ▾`처럼 **등급 상승 확률**만 말하고, 한 줄을
 * 누르면 그 등급의 확정까지 횟수·재해석 비용과 **열두 종 특성의 그 등급 수치**가 펼쳐진다. 한 번에 한
 * 등급만 펼치고(아코디언), 펼치고 접을 때는 같은 제목으로 판을 갈아 끼운다.
 *
 * 숫자는 전부 `RUNE_TRAIT_RULES`와 정적 정의에서 그대로 읽는다 — 이 창이 따로 적어 두면 밸런스를
 * 고친 날 화면만 옛 값을 말한다. 창 높이는 손으로 적지 않고 쌓인 줄에서 거꾸로 구한다.
 *
 * **표 머리·정보 칸·특성 이름을 누르면 뜻 쪽지가 뜬다**(`addOddsTip` — 규칙어 태그와 같은 용어 쪽지).
 * 특성 이름은 그 등급의 실제 효과 문장(`runeTraitView`)을 연다 — 수치만 늘어놓은 목록은 무엇이 오르는
 * 특성인지 말하지 못한다(응태 2026-11-23). 특성 목록은 줄마다 유리 판 한 장에 이름과 값이 선다.
 */

const ODDS = {
  width: 920,
  padding: 40,
  /** 판 윗변을 고정한다 — 펼칠 때 판이 위아래로 함께 자라 방금 누른 줄이 손 밑에서 달아나지 않게. */
  screenTop: 140,
  topRoom: 92,
  /** 등급 줄 위의 머리 띠(등급 · 상승 확률). */
  headHeight: 46,
  headRoom: 58,
  tierStep: 92,
  tierHeight: 78,
  tierLabelSize: 36,
  tierValueSize: 32,
  /** 펼친 안쪽의 줄 높이. */
  infoStep: 64,
  traitStep: 62,
  indent: 34,
  columnGap: 28,
  entryPad: 10,
  /** 특성 제목표 한 줄이 드는 높이. */
  titleRoom: 80,
  bottomPad: 56,
} as const;

/** 소수점이 있는 값만 한 자리를 남긴다. `1.5`와 `10`이 한 줄에 같은 모양으로 서지 않게 한다. */
function traitValueLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** 등급 색. 룬 희귀도와 같은 한 표를 읽는다 — 특성 등급 축을 새로 칠하지 않는다. */
function gradeHex(grade: RuneTraitGrade): string {
  return `#${RUNE_ACCENT[grade].toString(16).padStart(6, "0")}`;
}

/** 펼친 한 등급이 차지하는 높이. 정보 줄 둘 + 제목표 + 두 칸으로 선 특성 줄. */
function expandedHeight(grade: RuneTraitGrade): number {
  return ODDS.entryPad * 2 + ODDS.infoStep * 2 + ODDS.titleRoom + Math.ceil(eligibleDefs(grade).length / 2) * ODDS.traitStep;
}

/** 그 등급에서 풀에 드는 특성만 — 영웅 이상·전설 전용은 낮은 등급 표에 서지 않는다. */
function eligibleDefs(grade: RuneTraitGrade): readonly (typeof RUNE_TRAIT_DEFS)[number][] {
  return RUNE_TRAIT_DEFS.filter((def) => RUNE_TRAIT_GRADES.indexOf(def.minGrade) <= RUNE_TRAIT_GRADES.indexOf(grade));
}

export function openRuneTraitOdds(options: { scene: Phaser.Scene; popups: PopupLayer }, expanded: RuneTraitGrade | null = RUNE_TRAIT_GRADES[0]): void {
  const { scene, popups } = options;
  const height = ODDS.topRoom + ODDS.headRoom + RUNE_TRAIT_GRADES.length * ODDS.tierStep + (expanded === null ? 0 : expandedHeight(expanded)) + ODDS.bottomPad - (ODDS.tierStep - ODDS.tierHeight);

  popups.open({
    width: ODDS.width, height, title: t("rune.trait.odds"), y: ODDS.screenTop + height / 2,
    backButton: true, dim: true, closeOnBackdrop: true,
  }, (body, close) => {
    const left = -ODDS.width / 2 + ODDS.padding;
    const inner = ODDS.width - ODDS.padding * 2;
    const keywords = new KeywordManager(scene, popups);
    let y = -height / 2 + ODDS.topRoom - 14;
    paintHeadStrip(scene, body, keywords, y, inner);
    y += ODDS.headRoom;

    for (const grade of RUNE_TRAIT_GRADES) {
      const isOpen = expanded === grade;
      addTierRow(scene, body, 0, y + ODDS.tierHeight / 2, inner, grade, isOpen, () => {
        close();
        openRuneTraitOdds(options, isOpen ? null : grade);
      });
      y += ODDS.tierStep;
      if (!isOpen) continue;
      y += ODDS.entryPad - (ODDS.tierStep - ODDS.tierHeight) / 2;
      y = paintExpanded(scene, body, keywords, left + ODDS.indent, y, inner - ODDS.indent, grade);
      y += ODDS.entryPad + (ODDS.tierStep - ODDS.tierHeight) / 2;
    }
  });
}

/** 등급 줄 위의 머리 띠 — `등급 ……… 상승 확률`. 두 머리글이 저마다 뜻 쪽지를 연다. */
function paintHeadStrip(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, keywords: KeywordManager, top: number, width: number): void {
  const y = top + ODDS.headHeight / 2;
  const shape = chipPoints(width, ODDS.headHeight, { bevel: { topLeft: 14, bottomRight: 14 } });
  parent.add(drawLayer(scene, 0, y, shape, { fill: 0x0a1017, alpha: 0.92, shadow: false, edge: COLOR.accent, edgeAlpha: 0.7 }));
  const head = (x: number, originX: number, label: string, description: string): void => {
    const holder = scene.add.container(x, y);
    parent.add(holder);
    const text = scene.add.text(0, -2, label, textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(originX, 0.5);
    holder.add(text);
    const textLeft = -text.displayWidth * originX;
    holder.add(drawTipUnderline(scene, textLeft, 12, text.displayWidth, 0xa9b4bf, 0.55));
    const hitWidth = text.displayWidth + 30;
    const hitHolder = scene.add.container(textLeft + text.displayWidth / 2, 0);
    holder.add(hitHolder);
    addOddsTip(scene, hitHolder, hitWidth, ODDS.headHeight - 4, keywords, { term: label, description });
  };
  head(-width / 2 + 30, 0, t("rune.trait.odds.colGrade"), t("rune.trait.odds.tip.grade"));
  head(width / 2 - 74, 1, t("rune.trait.odds.colChance"), t("rune.trait.odds.tip.chance"));
}

/** 등급 한 줄 — `고급 • • • 12% ▾`. 줄 전체가 눌린다. */
function addTierRow(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, width: number,
  grade: RuneTraitGrade, isOpen: boolean, onToggle: () => void,
): void {
  const tone = RUNE_ACCENT[grade];
  const holder = scene.add.container(x, y);
  parent.add(holder);
  const shape = chipPoints(width, ODDS.tierHeight, { bevel: { topLeft: 18, bottomRight: 18 } });
  holder.add(drawLayer(scene, 0, 0, shape, { fill: isOpen ? 0x1a2230 : 0x121821, alpha: HOLO.glass + 0.2, edge: tone, edgeAlpha: isOpen ? 0.95 : 0.55 }));

  const left = -width / 2 + 30;
  const right = width / 2 - 30;
  const label = scene.add.text(left, 0, runeRarityLabel(grade), textStyle({ role: "display", size: ODDS.tierLabelSize, color: gradeHex(grade) }))
    .setOrigin(0, 0.5).setShadow(0, 3, "#000000", 4, false, true);
  shrinkTextToWidth(label, 200);
  holder.add(label);
  holder.add(drawGlyph(scene, "caret-down", right - 12, 0, 26, 0xf2f0ec, 0.85).setAngle(isOpen ? 180 : 0));

  // 전설은 오를 곳이 없다. 확률 0을 그대로 적으면 "0%로 오른다"로 읽힌다.
  const chance = RUNE_TRAIT_RULES.upgradeChance[grade];
  const value = chance <= 0
    ? scene.add.text(right - 44, 0, t("rune.trait.odds.max"), textStyle({ role: "body", size: 24, color: COLOR.inkDim }))
    : scene.add.text(right - 44, 0, t("rune.trait.odds.percent", { percent: traitValueLabel(chance * 100) }),
      textStyle({ role: "display", size: ODDS.tierValueSize, color: COLOR.ink }));
  value.setOrigin(1, 0.5).setShadow(0, 3, "#000000", 4, false, true);
  holder.add(value);

  // 이름과 값을 잇는 점줄 — 둘이 한 줄의 양 끝이라는 것을 눈이 따라가게 한다.
  const dots = scene.add.graphics();
  dots.fillStyle(tone, 0.8);
  for (let dx = left + label.displayWidth + 26; dx <= value.x - value.width - 26; dx += 22) {
    dots.fillPoints([new Phaser.Geom.Point(dx, -4), new Phaser.Geom.Point(dx + 4, 0), new Phaser.Geom.Point(dx, 4), new Phaser.Geom.Point(dx - 4, 0)], true);
  }
  holder.add(dots);

  const hit = scene.add.rectangle(0, 0, width, ODDS.tierHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(holder));
  hit.on("pointerout", () => pressOut(holder, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(holder); onToggle(); });
  holder.add(hit);
}

/** 펼친 안쪽을 그리고 다음 줄이 시작할 y를 돌려준다. */
function paintExpanded(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, keywords: KeywordManager, left: number, top: number, width: number, grade: RuneTraitGrade,
): number {
  let y = top;
  const right = left + width - 12;
  const tone = RUNE_ACCENT[grade];
  // 정보 두 줄은 줄 판 한 장씩 — 줄 전체가 그 값의 뜻 쪽지를 연다.
  const infoRow = (labelText: string, valueText: string, description: string, icon?: string): void => {
    const rowHeight = ODDS.infoStep - 8;
    const holder = scene.add.container(left + width / 2, y + ODDS.infoStep / 2);
    parent.add(holder);
    holder.add(drawLayer(scene, 0, 0, chipPoints(width, rowHeight, { bevel: { topLeft: 12, bottomRight: 12 } }), { fill: 0x0d141c, alpha: 0.85, shadow: false }));
    const label = scene.add.text(-width / 2 + 22, -2, labelText, textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5);
    holder.add(label);
    holder.add(drawTipUnderline(scene, label.x, 14, label.displayWidth, 0xa9b4bf, 0.5));
    const value = scene.add.text(right - left - width / 2 - 10, 0, valueText, textStyle({ role: "display", size: 28, color: icon ? COLOR.accentText : COLOR.ink })).setOrigin(1, 0.5);
    holder.add(value);
    if (icon) holder.add(scene.add.image(value.x - value.width - 24, 0, icon).setDisplaySize(34, 34));
    addOddsTip(scene, holder, width, rowHeight, keywords, { term: labelText, description });
    y += ODDS.infoStep;
  };
  const pity = RUNE_TRAIT_RULES.pityThreshold[grade];
  infoRow(t("rune.trait.odds.colPity"), pity > 0 ? t("rune.trait.odds.pity", { count: pity }) : t("rune.trait.odds.max"),
    pity > 0 ? t("rune.trait.odds.tip.pity", { count: pity }) : t("rune.trait.odds.tip.top"));
  infoRow(t("rune.trait.odds.colCost"), String(RUNE_TRAIT_RULES.rerollCost[grade]), t("rune.trait.odds.tip.cost", { cost: RUNE_TRAIT_RULES.rerollCost[grade] }), "currency-orestone");

  addSectionTitle(scene, left, y + 32, t("rune.trait.odds.listTitle"), { size: 24, parent });
  y += ODDS.titleRoom;

  const half = (width - ODDS.columnGap) / 2;
  const defs = eligibleDefs(grade);
  defs.forEach((def, order) => {
    const x = left + (order % 2) * (half + ODDS.columnGap);
    const row = y + Math.floor(order / 2) * ODDS.traitStep + ODDS.traitStep / 2;
    const cellHeight = ODDS.traitStep - 10;
    const holder = scene.add.container(x + half / 2, row);
    parent.add(holder);
    // 줄 판 — 두 칸이 엇갈려 줄마다 한 톤씩 다르다. 등급색 빗금이 그 값의 등급을 말한다.
    holder.add(drawLayer(scene, 0, 0, chipPoints(half, cellHeight, { bevel: { topLeft: 10, bottomRight: 10 } }), {
      fill: Math.floor(order / 2) % 2 === 0 ? 0x121a24 : 0x16202c, alpha: HOLO.glass + 0.22, shadow: { x: 3, y: 4 },
    }));
    const tick = scene.add.graphics();
    tick.fillStyle(tone, 0.9);
    tick.fillPoints([new Phaser.Geom.Point(-half / 2 + 12, cellHeight / 2 - 10), new Phaser.Geom.Point(-half / 2 + 18, -cellHeight / 2 + 10), new Phaser.Geom.Point(-half / 2 + 24, -cellHeight / 2 + 10), new Phaser.Geom.Point(-half / 2 + 18, cellHeight / 2 - 10)], true);
    holder.add(tick);
    const value = scene.add.text(half / 2 - 16, 0, `${formatRatePercent(runeTraitPickChance(RUNE_TRAIT_POOL, grade, def.id, LEGENDARY_EXCLUSIVE_SHARE))}%`,
      textStyle({ role: "display", size: 26, color: gradeHex(grade) })).setOrigin(1, 0.5).setShadow(0, 3, "#000000", 4, false, true);
    const name = scene.add.text(-half / 2 + 36, -2, runeTraitName(def.id), textStyle({ role: "emphasis", size: 25, color: COLOR.ink })).setOrigin(0, 0.5);
    shrinkTextToWidth(name, half - value.width - 70);
    holder.add([name, value]);
    holder.add(drawTipUnderline(scene, name.x, 14, name.displayWidth, 0xa9b4bf, 0.4));
    const view = runeTraitView({ id: def.id, grade, upgradeMisses: 0 });
    addOddsTip(scene, holder, half, cellHeight, keywords, { term: `${view.name} · ${view.gradeLabel}`, description: view.description, kind: "runeTrait" });
  });
  return y + Math.ceil(defs.length / 2) * ODDS.traitStep;
}
