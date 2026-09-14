import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { BASE_WIDTH } from "../config/gameConfig";
import { runeDisplayName, runePartLabel, runeRarityLabel, type RuneInstance, type RuneStatKey } from "../core/runes";
import { KeywordManager } from "../managers/KeywordManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { chipPoints, drawHairline, drawLayer, HOLO, slantedRect } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import {
  RESEARCH_BENCH, researchActionY, researchBenchWidth, researchDetailBounds, researchSlotCenter,
} from "./researchBenchLayout";
import { addRuneCard, addRuneFrame, RUNE_ACCENT } from "./runeIcons";
import { runeStatLabel } from "./RunePopup";
import { runeTraitView } from "./runeTraitPresentation";
import { addSectionTitle } from "./SectionTitle";
import { COLOR, textStyle } from "./theme";

/**
 * 특성 연구대.
 *
 * **룬을 늘어놓지 않는다.** 칸 하나에 룬을 끼우고 그 룬만 들여다보는 자리다 — 목록이면 어느
 * 룬을 만지는 중인지 화면이 말하지 않고, 조작 버튼이 룬마다 따로 서야 한다.
 *
 * 끼우면 연구대가 **왼쪽으로 밀리고** 그 오른쪽에 상세가 들어선다. 아래는 그 룬의 특성에
 * 대해 지금 할 수 있는 일뿐이다.
 */

/** 연구대가 아래 줄에 세우는 조작 한 줄이다. 화면이 아니라 부른 쪽이 무엇을 세울지 정한다. */
export interface ResearchBenchAction {
  labelKey: TextKey;
  enabled: boolean;
  /** 값을 치르는 조작만 버튼 안에 비용을 박는다. */
  cost?: { icon: "currency-orestone"; amount: number };
  onPress: () => void;
}

export interface ResearchBenchOptions {
  scene: Phaser.Scene;
  parent: Phaser.GameObjects.Container;
  popups: PopupLayer;
  keywords: KeywordManager;
  /** 지금 끼워져 있는 룬. 비면 칸이 가운데에 서고 상세가 열리지 않는다. */
  rune?: RuneInstance;
  /** 칸을 누르면 연다. 고른 룬은 부른 쪽이 상태로 들고 다시 그린다. */
  onPick: (rune: RuneInstance) => void;
  /** 끼운 룬을 빼낸다. */
  onClear: () => void;
  actions: readonly ResearchBenchAction[];
}

/** 룬 가방 격자의 자리. 정보창의 장착용 가방과 같은 규격을 쓴다. */
const PICKER = { columns: 4, cardWidth: 180, cardHeight: 180, cellWidth: 208, cellHeight: 208, headerHeight: 176 } as const;

/**
 * 끼울 룬을 고르는 가방.
 *
 * **자리(part)로 거르지 않는다** — 연구대는 어느 칸의 룬이든 다루는 자리라, 장착용 가방처럼
 * 한 자리만 보여 주면 나머지 룬은 여기서 영영 손댈 수 없다.
 */
function openRunePicker(options: { scene: Phaser.Scene; popups: PopupLayer; onPick: (rune: RuneInstance) => void }): void {
  const { scene, popups } = options;
  // 특성이 있는 룬이 먼저 선다 — 연구 중인 것이 곧 지금 찾는 것이다.
  const runes = [...session.runeInventory].sort((a, b) =>
    Number(b.trait !== undefined) - Number(a.trait !== undefined) || (a.sequence ?? 0) - (b.sequence ?? 0));
  const columns = PICKER.columns;
  const rows = Math.max(1, Math.ceil(runes.length / columns));
  const width = columns * PICKER.cellWidth + 96;
  const height = Math.min(1700, PICKER.headerHeight + (rows - 1) * PICKER.cellHeight + PICKER.cardHeight / 2 + 48);
  popups.open({ width, height, title: t("archaeology.bench.pick"), dim: true, backButton: true }, (body, close) => {
    const top = -height / 2;
    const firstX = -((columns - 1) * PICKER.cellWidth) / 2;
    runes.forEach((rune, order) => {
      const x = firstX + (order % columns) * PICKER.cellWidth;
      const y = top + PICKER.headerHeight + Math.floor(order / columns) * PICKER.cellHeight;
      const card = addRuneCard(scene, x, y, PICKER.cardWidth, PICKER.cardHeight, rune);
      const hit = scene.add.rectangle(0, 0, PICKER.cardWidth, PICKER.cardHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => card.setScale(1.06));
      hit.on("pointerout", () => card.setScale(1));
      hit.on("pointerup", () => { card.setScale(1); close(); options.onPick(rune); });
      card.add(hit);
      body.add(card);
    });
  });
}

/** 옵션 한 줄씩. 상세는 **그 룬이 무엇을 올리나**까지만 말하고 세공은 룬 쪽지가 맡는다. */
function paintDetail(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, rune: RuneInstance): void {
  const bounds = researchDetailBounds(BASE_WIDTH);
  const accent = RUNE_ACCENT[rune.rarity];
  const rarity = runeRarityLabel(rune.rarity);
  parent.add(scene.add.text(bounds.left, bounds.top, `${rarity}  ·  ${runePartLabel(rune.part)}`,
    textStyle({ role: "emphasis", size: 20, color: `#${accent.toString(16).padStart(6, "0")}` })).setOrigin(0, 0));
  parent.add(scene.add.text(bounds.left, bounds.top + 30, runeDisplayName(rune),
    textStyle({ role: "display", size: 28 })).setOrigin(0, 0).setWordWrapWidth(bounds.right - bounds.left));
  parent.add(drawHairline(scene, (bounds.left + bounds.right) / 2, bounds.top + 84, bounds.right - bounds.left, { color: accent, alpha: 0.4 }));

  const stats: ReadonlyArray<{ key: RuneStatKey; value: number }> = [...rune.mainStats, ...rune.subStats];
  stats.slice(0, 5).forEach((stat, index) => {
    const y = bounds.top + 116 + index * 42;
    const main = index < rune.mainStats.length;
    parent.add(scene.add.text(bounds.left, y, runeStatLabel(stat.key), main
      ? textStyle({ role: "emphasis", size: 22, color: COLOR.ink })
      : textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0.5));
    parent.add(scene.add.text(bounds.right, y, `+${stat.value}%`,
      textStyle({ role: "display", size: 22, color: main ? `#${accent.toString(16).padStart(6, "0")}` : COLOR.ink })).setOrigin(1, 0.5));
  });
}

/** 이 탭이 주로 다루는 것은 특성이다. 연구대 아래에 그 한 줄이 크게 선다. */
function paintTrait(options: {
  scene: Phaser.Scene;
  parent: Phaser.GameObjects.Container;
  keywords: KeywordManager;
  rune: RuneInstance;
  width: number;
}): void {
  const { scene, parent, rune, width } = options;
  const left = RESEARCH_BENCH.inset + 34;
  const y = RESEARCH_BENCH.top + RESEARCH_BENCH.height + 34;
  addSectionTitle(scene, RESEARCH_BENCH.inset + 24, y, t("rune.trait.title"));
  if (rune.trait === undefined) {
    // **없으면 없다고만 말한다.** 무엇을 하면 생기는지는 아래 버튼이 이미 말하고 있다.
    parent.add(scene.add.text(left, y + 62, t("rune.trait.none"),
      textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0, 0));
    return;
  }
  const view = runeTraitView(rune.trait);
  const grade = scene.add.text(left, y + 62, `[${view.gradeLabel}]`,
    textStyle({ role: "emphasis", size: 24, color: `#${RUNE_ACCENT[rune.trait.grade].toString(16).padStart(6, "0")}` })).setOrigin(0, 0);
  parent.add(grade);
  parent.add(scene.add.text(left + grade.width + 12, y + 58, view.name, textStyle({ role: "display", size: 30 })).setOrigin(0, 0));
  const body = options.keywords.layout(view.description, { width: width - 68, size: 22, color: COLOR.ink });
  body.setPosition(left, y + 104);
  parent.add(body);
}

/**
 * 연구대 한 판을 세운다. 되돌려 받는 것은 없다 — 상태는 부른 화면이 들고, 바뀌면 다시 그린다.
 */
export function addResearchBench(options: ResearchBenchOptions): void {
  const { scene, parent, rune } = options;
  const width = researchBenchWidth(BASE_WIDTH);
  const slotted = rune !== undefined;

  // 연구대 판. 유리면 한 겹에 윗변 강조선만 둔다 — 사방을 두르면 액자가 되어 안의 룬 칸과
  // 두 겹으로 보인다.
  parent.add(drawLayer(scene, BASE_WIDTH / 2, RESEARCH_BENCH.top + RESEARCH_BENCH.height / 2,
    chipPoints(width, RESEARCH_BENCH.height, {
      bevel: { topLeft: width * 0.06, topRight: 0, bottomRight: width * 0.06, bottomLeft: 0 },
    }), { fill: 0x111b24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.5 }));

  const target = researchSlotCenter(BASE_WIDTH, slotted);
  const holder = scene.add.container(researchSlotCenter(BASE_WIDTH, false).x, target.y);
  parent.add(holder);
  // **끼우면 스르륵 밀린다.** 곧바로 옮겨 놓으면 상세가 어디서 나왔는지 읽히지 않는다.
  if (slotted) scene.tweens.add({ targets: holder, x: target.x, duration: RESEARCH_BENCH.slideMs, ease: "Cubic.Out" });

  if (rune) {
    holder.add(addRuneFrame(scene, 0, 0, RESEARCH_BENCH.slot, rune.rarity, rune.part,
      { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 }));
  } else {
    // 빈 칸은 **자리만 지킨다.** 무엇을 하라는 문장을 적지 않는다 — 누를 수 있는 칸 하나뿐이라
    // 눌러 보면 알게 된다.
    holder.add(drawLayer(scene, 0, 0, slantedRect(RESEARCH_BENCH.slot, RESEARCH_BENCH.slot, 26), {
      fill: 0x0a1017, alpha: 0.72, edge: COLOR.accent, edgeAlpha: 0.28,
    }));
  }
  const hit = scene.add.rectangle(0, 0, RESEARCH_BENCH.slot, RESEARCH_BENCH.slot, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  hit.on("pointerup", () => openRunePicker({ scene, popups: options.popups, onPick: options.onPick }));
  holder.add(hit);

  if (rune) {
    // 상세는 밀린 뒤에 들어선다. 함께 뜨면 칸이 미는 동안 글자가 그 위를 지나간다.
    const detail = scene.add.container(0, 0).setAlpha(0);
    parent.add(detail);
    paintDetail(scene, detail, rune);
    scene.tweens.add({ targets: detail, alpha: 1, delay: RESEARCH_BENCH.slideMs * 0.6, duration: 200 });
    paintTrait({ scene, parent, keywords: options.keywords, rune, width });

    const clear = scene.add.text(BASE_WIDTH - RESEARCH_BENCH.inset - 30, RESEARCH_BENCH.top + 22,
      t("archaeology.bench.clear"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0);
    clear.setInteractive({ useHandCursor: true }).on("pointerup", () => options.onClear());
    parent.add(clear);
  }

  options.actions.forEach((action, index) => {
    const button = new Button(scene, BASE_WIDTH / 2, researchActionY(index), {
      width: RESEARCH_BENCH.actionWidth,
      height: RESEARCH_BENCH.actionHeight,
      label: t(action.labelKey),
      ...(action.cost ? { cost: { ...action.cost, affordable: action.enabled } } : {}),
      onClick: () => { if (action.enabled) action.onPress(); },
    });
    button.setEnabled(action.enabled);
    parent.add(button);
  });
}
