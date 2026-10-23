import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_WIDTH } from "../config/gameConfig";
import { runeRarityLabel, type RuneInstance, type RuneRarity } from "../core/runes";
import { isRuneSynthesisMaterial, RUNE_SYNTHESIS_INPUTS, RUNE_SYNTHESIS_RULES, runeSynthesisRarityOdds, runeSynthesisTraitOdds } from "../core/runeSynthesis";
import { RUNE_TRAIT_GRADES } from "../core/runeTraits";
import { session } from "../state/session";
import { Button } from "./Button";
import { chipPoints, drawLayer, drawShapeEdge, HOLO, slantedRect } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_TITLE_SIZE } from "./popupGeometry";
import { pressIn, pressOut } from "./pressFeedback";
import { researchPlateBevel } from "./researchBenchLayout";
import { addRuneCard, addRuneFrame, RUNE_ACCENT } from "./runeIcons";
import { RUNE_SYNTHESIS, runeSynthesisButtonCenter, runeSynthesisCenter, runeSynthesisOddsBounds, runeSynthesisPlateBounds, runeSynthesisVertices } from "./runeSynthesisLayout";
import { addSectionTitle } from "./SectionTitle";
import { COLOR, textStyle } from "./theme";

/**
 * 룬 합성대.
 *
 * 삼각형 꼭짓점 셋에 각인까지 마친 같은 등급 룬을 하나씩 넣고 아래 합성 버튼(골드)을 누른다.
 * 넣은 룬에서 결과 등급·특성의 확률이 곧바로 판 아래에 선다 — 무엇을 넣으면 무엇이 나올
 * 가능성이 있는지가 누르기 전에 읽혀야 한다. 판정은 서버가, 확률은 `runeSynthesis.ts`가 갖는다.
 */

export interface RuneSynthesisBenchOptions {
  scene: Phaser.Scene;
  parent: Phaser.GameObjects.Container;
  popups: PopupLayer;
  /** 꼭짓점마다 넣은 룬. 길이는 늘 3이다. */
  slots: readonly (RuneInstance | undefined)[];
  onPick: (index: number, rune: RuneInstance) => void;
  onClear: (index: number) => void;
  onSynthesize: () => void;
  /** 연출이 도는 동안은 칸·버튼을 받지 않는다. */
  busy: boolean;
}

/** 합성대가 세운 조각 중 연출이 움직일 것들. */
export interface RuneSynthesisBenchHandles {
  /** 꼭짓점의 룬 액자(빈 칸이면 undefined). */
  frames: readonly (Phaser.GameObjects.Container | undefined)[];
  core: Phaser.GameObjects.Container;
}

const PICKER = { columns: 4, cardWidth: 180, cardHeight: 180, cellWidth: 208, cellHeight: 208, headerHeight: 176, emptyHeight: 420 } as const;

/**
 * 넣을 룬을 고르는 가방.
 *
 * **넣을 수 있는 룬만 보여 준다** — 각인까지 마쳤고, 잠기지 않았고(끼고 있는 룬도 넣을 수 있다),
 * 이미 넣은 룬이 있으면 그 등급인 것. 못 쓰는 룬을 흐리게 늘어놓으면 왜 못 쓰는지 하나하나
 * 눌러 봐야 한다.
 */
function openSynthesisPicker(options: { scene: Phaser.Scene; popups: PopupLayer; rarity: RuneRarity | undefined; taken: ReadonlySet<string>; onPick: (rune: RuneInstance) => void }): void {
  const { scene, popups } = options;
  const runes = session.runeInventory
    .filter((rune) => isRuneSynthesisMaterial(rune) && !options.taken.has(rune.instanceId) && (options.rarity === undefined || rune.rarity === options.rarity))
    .sort((a, b) => RUNE_TRAIT_GRADES.indexOf(b.rarity) - RUNE_TRAIT_GRADES.indexOf(a.rarity) || (a.sequence ?? 0) - (b.sequence ?? 0));
  const columns = PICKER.columns;
  const rows = Math.max(1, Math.ceil(runes.length / columns));
  const width = columns * PICKER.cellWidth + 96;
  const height = runes.length === 0 ? PICKER.emptyHeight : Math.min(1700, PICKER.headerHeight + (rows - 1) * PICKER.cellHeight + PICKER.cardHeight / 2 + 48);
  popups.open({ width, height, title: t("archaeology.synth.pick"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, backButton: true }, (body, close) => {
    if (runes.length === 0) {
      body.add(scene.add.text(0, 10, t("archaeology.synth.pickEmpty"), textStyle({ role: "body", size: 28, color: COLOR.inkDim, align: "center", wrap: width - 140 })).setOrigin(0.5));
      return;
    }
    const top = -height / 2;
    const firstX = -((columns - 1) * PICKER.cellWidth) / 2;
    runes.forEach((rune, order) => {
      const x = firstX + (order % columns) * PICKER.cellWidth;
      const y = top + PICKER.headerHeight + Math.floor(order / columns) * PICKER.cellHeight;
      const card = addRuneCard(scene, x, y, PICKER.cardWidth, PICKER.cardHeight, rune);
      const hit = scene.add.rectangle(0, 0, PICKER.cardWidth, PICKER.cardHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(card));
      hit.on("pointerout", () => pressOut(card, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(card); close(); options.onPick(rune); });
      card.add(hit);
      body.add(card);
    });
  });
}

/** 판 한 장 — 특성 연구대와 같은 유리면·깎임·밑변 한 줄. */
function addPlate(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, bounds: { left: number; right: number; top: number; bottom: number }): void {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const shape = chipPoints(width, height, { bevel: researchPlateBevel(width) });
  const x = (bounds.left + bounds.right) / 2;
  const y = (bounds.top + bounds.bottom) / 2;
  parent.add(drawLayer(scene, x, y, shape, { fill: 0x111b24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.5 }));
  parent.add(drawShapeEdge(scene, x, y, shape, "bottom", { color: COLOR.accent, alpha: 0.2, inset: 10 }));
}

/** 가운데 빛 — 모일 자리. 넣은 수만큼 밝아지고, 셋이 차면 천천히 숨 쉰다. */
function addCore(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, filled: number, color: number): Phaser.GameObjects.Container {
  const core = scene.add.container(x, y);
  parent.add(core);
  const size = RUNE_SYNTHESIS.core;
  const glow = scene.add.star(0, 0, 4, size * 0.18, size * 0.62, color, 0.12 + filled * 0.12).setScale(1, 0.78);
  const heart = scene.add.star(0, 0, 4, size * 0.08, size * 0.3, 0xffffff, 0.25 + filled * 0.2).setScale(1, 0.78);
  core.add([glow, heart]);
  if (filled >= RUNE_SYNTHESIS_INPUTS) {
    scene.tweens.add({ targets: glow, scaleX: 1.18, scaleY: 0.92, alpha: 0.62, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }
  return core;
}

/** 확률 판 — 결과 등급 막대와 특성 막대 두 줄. 재료가 비면 무엇을 넣는지만 말한다. */
function paintOdds(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, slots: readonly (RuneInstance | undefined)[]): void {
  const bounds = runeSynthesisOddsBounds(BASE_WIDTH);
  addPlate(scene, parent, bounds);
  const width = bounds.right - bounds.left;
  addSectionTitle(scene, bounds.left + researchPlateBevel(width).topLeft + 10, bounds.top, t("archaeology.synth.odds"), { parent });
  const placed = slots.filter((rune): rune is RuneInstance => rune !== undefined);
  const left = bounds.left + 44;
  const right = bounds.right - 44;
  if (placed.length === 0) {
    parent.add(scene.add.text((bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2 + 10, t("archaeology.synth.hint"),
      textStyle({ role: "body", size: 27, color: COLOR.inkDim, align: "center", wrap: width - 100 })).setOrigin(0.5));
    return;
  }
  const rarity = placed[0].rarity;
  const odds = runeSynthesisRarityOdds(rarity);
  const rarityRows = [{ label: runeRarityLabel(rarity), percent: odds.same, color: RUNE_ACCENT[rarity] }];
  if (odds.next !== undefined) rarityRows.push({ label: runeRarityLabel(odds.next), percent: odds.up, color: RUNE_ACCENT[odds.next] });
  const traitOdds = runeSynthesisTraitOdds(slots.map((rune) => rune?.trait));
  const traitRows = traitOdds.map((percent, index) => ({
    label: index === 0 ? t("archaeology.synth.traitNone") : runeRarityLabel(RUNE_TRAIT_GRADES[index - 1]),
    percent,
    color: index === 0 ? 0x4a5560 : RUNE_ACCENT[RUNE_TRAIT_GRADES[index - 1]],
  })).filter((row) => row.percent > 0);
  addOddsBar(scene, parent, left, right, bounds.top + 92, t("archaeology.synth.rarity"), rarityRows);
  addOddsBar(scene, parent, left, right, bounds.top + 182, t("archaeology.synth.trait"), traitRows);
}

/**
 * 확률 한 줄 — 이름표 아래 한 막대를 칸마다 등급색이 나눠 갖는다.
 *
 * 숫자만 늘어놓으면 어느 쪽이 큰지 읽는 데 셈이 든다. 칸 너비가 곧 확률이라 한눈에 기운 쪽이 보인다.
 */
function addOddsBar(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, left: number, right: number, y: number, label: string, rows: readonly { label: string; percent: number; color: number }[]): void {
  parent.add(scene.add.text(left, y - 30, label, textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
  const total = right - left;
  let x = left;
  rows.forEach((row) => {
    const span = (total * row.percent) / 100;
    const cell = scene.add.rectangle(x + span / 2, y + 10, Math.max(2, span - 4), RUNE_SYNTHESIS.oddsBar, row.color, 0.82);
    parent.add(cell);
    const text = `${row.label} ${row.percent}%`;
    const tag = scene.add.text(x + span / 2, y + 10, text, textStyle({ role: "emphasis", size: 19, color: COLOR.ink })).setOrigin(0.5).setStroke("#000000", 4);
    // 좁은 칸은 숫자만 남긴다 — 이름까지 넣으면 이웃 칸 위로 넘친다.
    if (tag.width > span - 8) tag.setText(`${row.percent}%`);
    if (tag.width > span - 4) tag.setVisible(false);
    parent.add(tag);
    x += span;
  });
}

/** 합성대 한 판을 세운다. 상태는 부른 화면이 들고, 바뀌면 다시 그린다. */
export function addRuneSynthesisBench(options: RuneSynthesisBenchOptions): RuneSynthesisBenchHandles {
  const { scene, parent, slots } = options;
  const plate = runeSynthesisPlateBounds(BASE_WIDTH);
  addPlate(scene, parent, plate);
  const center = runeSynthesisCenter(BASE_WIDTH);
  const vertices = runeSynthesisVertices(BASE_WIDTH);
  const placed = slots.filter((rune): rune is RuneInstance => rune !== undefined);
  const rarity = placed[0]?.rarity;
  const tone = rarity ? RUNE_ACCENT[rarity] : COLOR.accent;

  // 삼각형 — 꼭짓점끼리, 그리고 꼭짓점에서 가운데로. 넣은 칸에서 가운데로 가는 선만 밝다.
  const lines = scene.add.graphics();
  parent.add(lines);
  lines.lineStyle(3, tone, 0.28);
  lines.strokePoints(vertices.map(({ x, y }) => new Phaser.Geom.Point(x, y)), true);
  vertices.forEach((vertex, index) => {
    lines.lineStyle(slots[index] ? 4 : 2, tone, slots[index] ? 0.7 : 0.22);
    lines.lineBetween(vertex.x, vertex.y, center.x, center.y);
  });

  const core = addCore(scene, parent, center.x, center.y, placed.length, tone);
  const taken = new Set(placed.map(({ instanceId }) => instanceId));
  const frames = vertices.map((vertex, index) => {
    const rune = slots[index];
    const holder = scene.add.container(vertex.x, vertex.y);
    parent.add(holder);
    if (rune) {
      holder.add(addRuneFrame(scene, 0, 0, RUNE_SYNTHESIS.slot, rune.rarity, rune.part, { mainStats: rune.mainStats, engraved: true }));
    } else {
      holder.add(drawLayer(scene, 0, 0, slantedRect(RUNE_SYNTHESIS.slot, RUNE_SYNTHESIS.slot, 22), { fill: 0x0a1017, alpha: 0.72, edge: tone, edgeAlpha: 0.32 }));
      // 빈 칸의 더하기 표식 — 누르면 무엇이 일어나는지 한 획이 말한다.
      holder.add(scene.add.rectangle(0, 0, 56, 8, tone, 0.55));
      holder.add(scene.add.rectangle(0, 0, 8, 56, tone, 0.55));
    }
    const hit = scene.add.rectangle(0, 0, RUNE_SYNTHESIS.slot, RUNE_SYNTHESIS.slot, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => { if (!options.busy) pressIn(holder); });
    hit.on("pointerout", () => pressOut(holder, "normal", { pop: false }));
    hit.on("pointerup", () => {
      pressOut(holder);
      if (options.busy) return;
      // 넣은 칸을 다시 누르면 뺀다 — 고르기 창을 다시 열어 바꾸는 것보다 손이 한 번 덜 든다.
      if (rune) { options.onClear(index); return; }
      openSynthesisPicker({ scene, popups: options.popups, rarity, taken, onPick: (picked) => options.onPick(index, picked) });
    });
    holder.add(hit);
    return rune ? holder : undefined;
  });

  paintOdds(scene, parent, slots);

  const button = runeSynthesisButtonCenter(BASE_WIDTH);
  const cost = rarity ? RUNE_SYNTHESIS_RULES.goldCost[rarity] : undefined;
  const ready = placed.length === RUNE_SYNTHESIS_INPUTS;
  const affordable = cost !== undefined && session.wallet.gold >= cost;
  parent.add(new Button(scene, button.x, button.y, {
    width: RUNE_SYNTHESIS.buttonWidth, height: RUNE_SYNTHESIS.buttonHeight, label: t("archaeology.synth.button"), fontSize: 38,
    variant: "primary", decorDots: true,
    ...(cost !== undefined ? { cost: { icon: "currency-gold" as const, amount: cost, affordable, abbreviate: true } } : {}),
    onClick: () => { if (!options.busy) options.onSynthesize(); },
  }).setEnabled(ready && affordable && !options.busy));

  return { frames, core };
}

