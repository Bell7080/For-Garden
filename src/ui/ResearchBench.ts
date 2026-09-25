import Phaser from "phaser";
import { POPUP_TITLE_SIZE } from "./popupGeometry";
import { t } from "../i18n";
import { BASE_WIDTH } from "../config/gameConfig";
import { runeDisplayName, runePartLabel, runeRarityLabel, type RuneInstance, type RuneStatKey } from "../core/runes";
import { KeywordManager } from "../managers/KeywordManager";
import { session } from "../state/session";
import { addResearchActionRow, type ResearchActionRowSpec } from "./ResearchActionRow";
import { chipPoints, drawHairline, drawLayer, drawShapeEdge, HOLO, slantedRect } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import {
  RESEARCH_BENCH, RESEARCH_TRAIT, researchActionY, researchBenchTop,
  researchDetailBounds, researchPlateBevel, researchSlotCenter, researchTraitBounds,
} from "./researchBenchLayout";
import { addRuneCard, addRuneFrame, RUNE_ACCENT } from "./runeIcons";
import { runeStatLabel } from "./RunePopup";
import { runeTraitView } from "./runeTraitPresentation";
import { addSectionTitle } from "./SectionTitle";
import { COLOR, textStyle } from "./theme";
import { pressIn, pressOut } from "./pressFeedback";

/**
 * 특성 연구대.
 *
 * **룬을 늘어놓지 않는다.** 칸 하나에 룬을 끼우고 그 룬만 들여다보는 자리다 — 목록이면 어느
 * 룬을 만지는 중인지 화면이 말하지 않고, 조작 버튼이 룬마다 따로 서야 한다.
 *
 * 끼우면 연구대가 **왼쪽으로 밀리고** 그 오른쪽에 상세가 들어선다. 아래는 그 룬의 특성에
 * 대해 지금 할 수 있는 일뿐이다.
 */

/**
 * 연구대가 아래 줄에 세우는 조작 한 줄이다. 화면이 아니라 부른 쪽이 무엇을 세울지 정한다.
 *
 * 생김새는 `ResearchActionRow` 한 장이 갖는다 — 아이템을 태우는 줄과 재화를 치르는 줄이 같은
 * 골격을 쓰므로, 무엇을 쓰는 조작인지가 줄마다 다른 양식으로 읽히지 않는다.
 */
export type ResearchBenchAction = ResearchActionRowSpec;

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
  /**
   * 방금 끼운 참이면 순서대로 들어선다.
   *
   * 특성을 부여하거나 재해석한 뒤의 다시 그리기까지 연출을 태우면, 같은 판이 조작할 때마다
   * 통째로 다시 조립되는 것으로 보인다 — 처음 끼우는 한 번만이다.
   */
  animate?: boolean;
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
  popups.open({ width, height, title: t("archaeology.bench.pick"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, backButton: true }, (body, close) => {
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

/**
 * 연구대·특성이 함께 쓰는 판 한 장.
 *
 * 유리면 한 겹에 **윗변 강조선과 밑변 그림자**만 둔다 — 사방을 두르면 액자가 되어 안의 룬
 * 칸과 두 겹으로 보인다. 깎임은 배치표 하나가 정해 두 판이 같은 실루엣으로 선다.
 */
function addResearchPlate(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  bounds: { left: number; right: number; top: number; bottom: number },
): void {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const shape = chipPoints(width, height, { bevel: researchPlateBevel(width) });
  const x = (bounds.left + bounds.right) / 2;
  const y = (bounds.top + bounds.bottom) / 2;
  parent.add(drawLayer(scene, x, y, shape, { fill: 0x111b24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.5 }));
  // 밑변 안쪽으로 한 줄. 깎인 모서리를 그대로 돌아 판이 바닥에서 떠 있는 것으로 읽힌다.
  parent.add(drawShapeEdge(scene, x, y, shape, "bottom", { color: COLOR.accent, alpha: 0.2, inset: 10 }));
}

/** 옵션 줄 앞의 작은 마름모. 구분선·로딩 칸과 같은 네 꼭짓점 표식을 눌러 쓴다. */
function addStatMark(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, color: number, main: boolean): void {
  const mark = scene.add.star(x, y, 4, main ? 4 : 3, main ? 9 : 7, color, main ? 0.9 : 0.5)
    .setScale(1, 0.78);
  if (main) mark.setStrokeStyle(2, color, 0.9);
  parent.add(mark);
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
    // **줄마다 마름모 하나를 박는다.** 이름과 값만 마주 세우면 어디까지가 한 줄인지 흐리고,
    // 주 옵션과 보조 옵션이 글자 굵기 하나로만 갈린다 — 표식이 크기와 채움으로 한 번 더 말한다.
    addStatMark(scene, parent, bounds.left + 9, y, main ? accent : COLOR.accent, main);
    parent.add(scene.add.text(bounds.left + 30, y, runeStatLabel(stat.key), main
      ? textStyle({ role: "emphasis", size: 22, color: COLOR.ink })
      : textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0.5));
    parent.add(scene.add.text(bounds.right, y, `+${stat.value}%`,
      textStyle({ role: "display", size: 22, color: main ? `#${accent.toString(16).padStart(6, "0")}` : COLOR.ink })).setOrigin(1, 0.5));
  });
}

/**
 * 특성 판.
 *
 * **제목만 세우지 않는다** — 제목표 아래 글이 바탕 위에 그냥 떠 있으면 어디까지가 특성
 * 이야기인지 말하지 못하고, 그 아래에서 시작하는 버튼 줄이 본문을 덮는다. 연구대와 같은
 * 유리면 한 겹을 깔고 제목표를 그 윗변에 걸터앉힌다.
 *
 * 특성이 없어도 판은 그대로 서고 안에 「특성 없음」 한 줄만 든다 — 판이 사라지면 룬을 끼울
 * 때마다 아래 버튼 줄이 오르내린다.
 */
function paintTrait(options: {
  scene: Phaser.Scene;
  parent: Phaser.GameObjects.Container;
  keywords: KeywordManager;
  rune: RuneInstance;
}): void {
  const { scene, parent, rune } = options;
  const bounds = researchTraitBounds(BASE_WIDTH);
  const width = bounds.right - bounds.left;
  addResearchPlate(scene, parent, bounds);
  // 제목표는 깎인 모서리 **안쪽**에서 시작한다. 왼쪽 끝에 붙이면 빗변 너머로 삐져나온다.
  addSectionTitle(scene, bounds.left + researchPlateBevel(width).topLeft + 10, bounds.top, t("rune.trait.title"), { parent });

  const left = bounds.left + RESEARCH_TRAIT.inset;
  if (rune.trait === undefined) {
    // **없으면 없다고만 말한다.** 무엇을 하면 생기는지는 아래 버튼이 이미 말하고 있다.
    parent.add(scene.add.text(left, (bounds.top + bounds.bottom) / 2, t("rune.trait.none"),
      textStyle({ role: "body", size: 30, color: COLOR.inkDim })).setOrigin(0, 0.5));
    return;
  }
  // **이 화면이 주로 읽는 글이라 크게 세운다.** 룬 옵션은 곁들이고 특성이 본문이다.
  const view = runeTraitView(rune.trait);
  const grade = scene.add.text(left, bounds.top + 88, `[${view.gradeLabel}]`,
    textStyle({ role: "emphasis", size: 28, color: `#${RUNE_ACCENT[rune.trait.grade].toString(16).padStart(6, "0")}` })).setOrigin(0, 0.5);
  parent.add(grade);
  parent.add(scene.add.text(left + grade.width + 14, bounds.top + 86, view.name,
    textStyle({ role: "display", size: 38 })).setOrigin(0, 0.5));
  const body = options.keywords.layout(view.description, { width: width - RESEARCH_TRAIT.inset * 2, size: 26, color: COLOR.ink });
  body.setPosition(left, bounds.top + 136);
  parent.add(body);
}

/**
 * 연구대 한 판을 세운다. 되돌려 받는 것은 없다 — 상태는 부른 화면이 들고, 바뀌면 다시 그린다.
 */
export function addResearchBench(options: ResearchBenchOptions): void {
  const { scene, parent, rune } = options;
  const slotted = rune !== undefined;
  const top = researchBenchTop(slotted);
  // 끼우는 그 순간만 연출을 태운다. 이미 끼워 둔 판을 다시 그릴 때는 제자리에서 곧바로 선다.
  const rising = slotted && options.animate === true;

  /** 판과 룬 칸을 함께 든다. **끼우면 이 덩어리가 통째로 올라간다.** */
  const bench = scene.add.container(0, rising ? RESEARCH_BENCH.emptyTop - RESEARCH_BENCH.top : 0);
  parent.add(bench);
  if (rising) scene.tweens.add({ targets: bench, y: 0, duration: RESEARCH_BENCH.riseMs, ease: "Cubic.Out" });

  addResearchPlate(scene, bench, {
    left: RESEARCH_BENCH.inset, right: BASE_WIDTH - RESEARCH_BENCH.inset,
    top, bottom: top + RESEARCH_BENCH.height,
  });

  const target = researchSlotCenter(BASE_WIDTH, slotted);
  const holder = scene.add.container(rising ? BASE_WIDTH / 2 : target.x, target.y);
  bench.add(holder);
  // **끼우면 스르륵 밀린다.** 곧바로 옮겨 놓으면 상세가 어디서 나왔는지 읽히지 않는다.
  if (rising) scene.tweens.add({ targets: holder, x: target.x, duration: RESEARCH_BENCH.slideMs, ease: "Cubic.Out" });

  if (rune) {
    holder.add(addRuneFrame(scene, 0, 0, RESEARCH_BENCH.slot, rune.rarity, rune.part,
      { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 }));
  } else {
    // 빈 칸은 자리를 지키고, **무엇을 하면 되는지 한 줄이 그 아래에 선다** — 칸 하나만 덩그러니
    // 있으면 이 화면이 눌러 보기 전까지 아무 말도 하지 않는다.
    holder.add(drawLayer(scene, 0, 0, slantedRect(RESEARCH_BENCH.slot, RESEARCH_BENCH.slot, 26), {
      fill: 0x0a1017, alpha: 0.72, edge: COLOR.accent, edgeAlpha: 0.28,
    }));
    holder.add(scene.add.text(0, RESEARCH_BENCH.slot / 2 + 44, t("archaeology.bench.empty"),
      textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
  }
  const hit = scene.add.rectangle(0, 0, RESEARCH_BENCH.slot, RESEARCH_BENCH.slot, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  hit.on("pointerup", () => openRunePicker({ scene, popups: options.popups, onPick: options.onPick }));
  holder.add(hit);

  if (rune) {
    // 상세는 밀린 뒤에 들어선다. 함께 뜨면 칸이 미는 동안 글자가 그 위를 지나간다.
    const detail = scene.add.container(0, 0).setAlpha(rising ? 0 : 1);
    bench.add(detail);
    paintDetail(scene, detail, rune);
    if (rising) scene.tweens.add({ targets: detail, alpha: 1, delay: RESEARCH_BENCH.detailDelay, duration: 200 });

    // **특성은 위에서 내려온다.** 연구대가 올라가며 낸 자리에 그 다음으로 들어서는 것이다.
    const trait = scene.add.container(0, rising ? -30 : 0).setAlpha(rising ? 0 : 1);
    parent.add(trait);
    paintTrait({ scene, parent: trait, keywords: options.keywords, rune });
    if (rising) scene.tweens.add({ targets: trait, y: 0, alpha: 1, delay: RESEARCH_BENCH.traitDelay, duration: 220, ease: "Cubic.Out" });

    const clear = scene.add.text(BASE_WIDTH - RESEARCH_BENCH.inset - 30, top + 22,
      t("archaeology.bench.clear"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0);
    clear.setInteractive({ useHandCursor: true }).on("pointerup", () => options.onClear());
    bench.add(clear);
  }

  options.actions.forEach((action, index) => {
    const button = addResearchActionRow(scene, parent, BASE_WIDTH / 2, researchActionY(index), action);
    if (!rising) return;
    // **버튼은 한 줄씩 늦게 선다.** 넷이 한꺼번에 뜨면 특성을 읽기도 전에 고르는 줄이 먼저 찬다.
    button.setAlpha(0);
    scene.tweens.add({
      targets: button, alpha: 1, duration: 160,
      delay: RESEARCH_BENCH.actionDelay + index * RESEARCH_BENCH.actionStagger,
    });
  });
}
