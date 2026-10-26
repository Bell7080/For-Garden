import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_WIDTH } from "../config/gameConfig";
import { runeRarityLabel, type RuneInstance, type RuneRarity } from "../core/runes";
import { isRuneSynthesisMaterial, RUNE_SYNTHESIS_INPUTS, RUNE_SYNTHESIS_RULES, runeSynthesisRarityOdds, runeSynthesisTraitOdds } from "../core/runeSynthesis";
import { RUNE_TRAIT_GRADES } from "../core/runeTraits";
import { session } from "../state/session";
import { Button } from "./Button";
import { chipPoints, drawLayer, drawShapeEdge, HOLO, HoloBar, slantedRect } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_TITLE_SIZE } from "./popupGeometry";
import { pressIn, pressOut } from "./pressFeedback";
import { mountRunePickerGrid } from "./runePickerGrid";
import { runePickerSize } from "./runePickerLayout";
import { researchPlateBevel } from "./researchBenchLayout";
import { addRuneFrame, RUNE_ACCENT } from "./runeIcons";
import { RUNE_SYNTHESIS, runeSynthesisButtonCenter, runeSynthesisCenter, runeSynthesisOddsBounds, runeSynthesisPlateBounds, runeSynthesisVertices } from "./runeSynthesisLayout";
import { addSectionTitle } from "./SectionTitle";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { motionPolicy } from "../core/settings";

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
  /** 확률 판. 연출이 도는 동안 흐려 둔다 — 사라진 재료의 확률이 그대로 서 있으면 안 된다. */
  odds: Phaser.GameObjects.Container;
}

const PICKER_EMPTY_HEIGHT = 420;

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
  const size = runePickerSize(runes.length);
  const width = size.width;
  const height = runes.length === 0 ? PICKER_EMPTY_HEIGHT : size.height;
  popups.open({ width, height, title: t("archaeology.synth.pick"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, backButton: true }, (body, close) => {
    if (runes.length === 0) {
      body.add(scene.add.text(0, 10, t("archaeology.synth.pickEmpty"), textStyle({ role: "body", size: 28, color: COLOR.inkDim, align: "center", wrap: width - 140 })).setOrigin(0.5));
      return;
    }
    mountRunePickerGrid(scene, body, { runes, isCovered: () => popups.isOpen, onPick: (rune) => { close(); options.onPick(rune); } });
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

/** 확률 판 — 결과 등급 게이지와 특성 게이지 두 줄. 재료가 비면 무엇을 넣는지만 말한다. */
function paintOdds(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, slots: readonly (RuneInstance | undefined)[]): Phaser.GameObjects.Container {
  const bounds = runeSynthesisOddsBounds(BASE_WIDTH);
  addPlate(scene, parent, bounds);
  const odds = scene.add.container(0, 0);
  parent.add(odds);
  const width = bounds.right - bounds.left;
  addSectionTitle(scene, bounds.left + researchPlateBevel(width).topLeft + 10, bounds.top, t("archaeology.synth.odds"), { parent: odds });
  const placed = slots.filter((rune): rune is RuneInstance => rune !== undefined);
  const left = bounds.left + 52;
  const right = bounds.right - 52;
  if (placed.length === 0) {
    lastOddsSignature = "";
    odds.add(scene.add.text((bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2 + 10, t("archaeology.synth.hint"),
      textStyle({ role: "body", size: 28, color: COLOR.inkDim, align: "center", wrap: width - 100 })).setOrigin(0.5));
    return odds;
  }
  const rarity = placed[0].rarity;
  const rarityOdds = runeSynthesisRarityOdds(rarity);
  const rarityRows: OddsRow[] = [{ label: runeRarityLabel(rarity), percent: rarityOdds.same, color: RUNE_ACCENT[rarity] }];
  if (rarityOdds.next !== undefined) rarityRows.push({ label: runeRarityLabel(rarityOdds.next), percent: rarityOdds.up, color: RUNE_ACCENT[rarityOdds.next], highlight: true });
  const traitOdds = runeSynthesisTraitOdds(slots.map((rune) => rune?.trait));
  const traitRows: OddsRow[] = traitOdds.map((percent, index) => ({
    label: index === 0 ? t("archaeology.synth.traitNone") : runeRarityLabel(RUNE_TRAIT_GRADES[index - 1]),
    percent,
    color: index === 0 ? TRAIT_NONE_COLOR : RUNE_ACCENT[RUNE_TRAIT_GRADES[index - 1]],
  })).filter((row) => row.percent > 0);
  // 같은 확률을 다시 그릴 때(칸 하나를 빼고 다시 넣는 등)는 차오르지 않는다 — 바뀐 것이 없는데 움직이면 새로 연 판처럼 읽힌다.
  const signature = JSON.stringify([rarityRows, traitRows].map((rows) => rows.map(({ percent }) => percent)));
  const animate = signature !== lastOddsSignature && motionPolicy(session.settings).nonEssentialRepeatFactor > 0;
  lastOddsSignature = signature;
  const [first, second] = RUNE_SYNTHESIS.oddsRows;
  addOddsGauge(scene, odds, left, right, bounds.top, first, t("archaeology.synth.rarity"), rarityRows, animate, 0);
  addOddsGauge(scene, odds, left, right, bounds.top, second, t("archaeology.synth.trait"), traitRows, animate, 1);
  return odds;
}

interface OddsRow { label: string; percent: number; color: number; highlight?: boolean }

/** 특성 없음 칸의 색. 다른 칸이 등급색이라 이 칸만 물러선 잿빛이다. */
const TRAIT_NONE_COLOR = 0x5b6874;

/** 지난번 확률 판이 그린 값. 같은 값을 다시 그릴 때는 차오르는 연출을 건너뛴다. */
let lastOddsSignature = "";

/**
 * 확률 한 줄 — 이름표, 등급색이 칸을 나눠 갖는 게이지 하나, 그 아래 칸마다의 범례.
 *
 * 게이지는 공용 `HoloBar`의 문법(기울기·짙은 홈·흰 외곽선·아래 그림자)을 그대로 쓴다. 칸마다
 * `HoloBar`를 한 장씩 덧대 구간만 칠하고(`setRange`), 경계는 흰 빗금이 가른다. 등급이 오르는 칸만
 * 안개가 일렁여 "노려볼 칸"이 먼저 읽힌다.
 */
function addOddsGauge(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, left: number, right: number, top: number,
  spot: { label: number; bar: number; legend: number }, label: string, rows: readonly OddsRow[], animate: boolean, phase: number,
): void {
  parent.add(scene.add.text(left, top + spot.label, label, textStyle({ role: "emphasis", size: RUNE_SYNTHESIS.oddsLabelSize, color: COLOR.ink })).setOrigin(0, 0.5));
  const total = right - left;
  const x = (left + right) / 2;
  const y = top + spot.bar;
  const height = RUNE_SYNTHESIS.oddsBar;
  const still = motionPolicy(session.settings).nonEssentialRepeatFactor <= 0;
  new HoloBar(scene, x, y, total, height, { color: COLOR.accent, trackAlpha: 0.85, shadow: { offsetX: 4, offsetY: 6, alpha: 0.6 } }).addTo(parent).setValue(0);
  const spans: { from: number; to: number }[] = [];
  let cursor = 0;
  rows.forEach((row) => { spans.push({ from: cursor, to: Math.min(1, cursor + row.percent / 100) }); cursor += row.percent / 100; });
  const segments = rows.map((row) => new HoloBar(scene, x, y, total, height, {
    color: row.color, trackAlpha: 0,
    ...(row.highlight ? { glow: { spread: 10, alpha: 0.22 }, shimmer: { still, phase } } : {}),
  }).addTo(parent));
  // 칸 경계의 흰 빗금 — 게이지 자신의 기울기를 따른다.
  const dividers = scene.add.graphics({ x, y });
  const slant = Math.min(HOLO.slant, height);
  spans.slice(0, -1).forEach(({ to }) => {
    const at = -total / 2 + total * to;
    dividers.lineStyle(4, 0x05070a, 0.85);
    dividers.lineBetween(at + slant / 2, -height / 2, at - slant / 2, height / 2);
    dividers.lineStyle(2, 0xffffff, 0.9);
    dividers.lineBetween(at + slant / 2, -height / 2, at - slant / 2, height / 2);
  });
  parent.add(dividers);
  new HoloBar(scene, x, y, total, height, { color: COLOR.accent, trackAlpha: 0, outline: true }).addTo(parent).setValue(0);
  const fill = (progress: number): void => segments.forEach((bar, index) => bar.setRange(spans[index].from * progress, spans[index].to * progress));
  if (animate) {
    fill(0);
    dividers.setAlpha(0);
    scene.tweens.addCounter({ from: 0, to: 1, duration: RUNE_SYNTHESIS.oddsFillMs, delay: phase * 90, ease: "Cubic.easeOut", onUpdate: (tween) => fill(tween.getValue() ?? 1) });
    scene.tweens.add({ targets: dividers, alpha: 1, duration: 160, delay: RUNE_SYNTHESIS.oddsFillMs * 0.7 + phase * 90 });
  } else {
    fill(1);
  }

  // 범례 — 칸마다 같은 폭을 나눠 갖고, 등급색 칸 · 이름 · 굵은 퍼센트가 한 덩어리로 선다.
  const cell = total / rows.length;
  rows.forEach((row, index) => {
    const legend = scene.add.container(left + cell * index, top + spot.legend);
    const swatchSize = RUNE_SYNTHESIS.oddsSwatch;
    legend.add(drawLayer(scene, swatchSize / 2, 0, slantedRect(swatchSize, swatchSize, 6), { fill: row.color, alpha: 1, edge: 0xffffff, edgeAlpha: 0.6 }));
    const name = scene.add.text(swatchSize + 10, 0, row.label, textStyle({ role: "emphasis", size: RUNE_SYNTHESIS.oddsNameSize, color: COLOR.ink })).setOrigin(0, 0.5);
    const percent = scene.add.text(0, 0, `${row.percent}%`, textStyle({ role: "display", size: RUNE_SYNTHESIS.oddsPercentSize, color: `#${(row.color === TRAIT_NONE_COLOR ? 0xc3ccd4 : row.color).toString(16).padStart(6, "0")}` }))
      .setOrigin(0, 0.5).setStroke("#05070a", 6);
    const room = cell - 16;
    // 이름과 수가 칸을 넘으면 이름만 누른다 — 읽어야 하는 것은 수다.
    squeezeTextToWidth(name, Math.max(40, room - swatchSize - 10 - percent.width - 10));
    percent.setX(name.x + name.displayWidth + 10);
    legend.add([name, percent]);
    parent.add(legend);
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

  const odds = paintOdds(scene, parent, slots);

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

  return { frames, core, odds };
}

