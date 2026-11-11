import Phaser from "phaser";
import { breakthroughEnhances } from "../core/relicProgression";
import type { Passive, RelicDef, Skill } from "../core/types";
import { t } from "../i18n";
import { KeywordManager } from "../managers/KeywordManager";
import { FaceFrame } from "./FaceFrame";
import { chipPoints, drawLayer } from "./holo";
import { buildFerocityViewModel, buildSkillViewModel, FEROCITY_BADGE_TONE } from "./info";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { RARITY_TONE } from "./rarityMark";
import { addSkillIconFrame, skillSlotLabel } from "./SkillIconFrame";
import type { SkillArtSlot } from "./skillArt";
import { formatEffectDescription } from "./skillExplanation";
import { breakthroughEffectText, skillKeywordLayoutOptions } from "./skillPresentation";
import { skillSummaryTags, type SkillInfoViewModel } from "./SkillPopup";
import { addSkillTagRow } from "./SkillTagRow";
import { SKILL_GLANCE, skillGlanceCardHeight, skillGlanceCardRoom, skillGlanceTabX } from "./skillGlanceLayout";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 판에 세울 아군 한 명 — 전투가 실제로 쓰는 정의(레벨·돌파·룬 반영)와 돌파 단계. */
export interface SkillGlanceAlly {
  def: RelicDef;
  breakthrough: number;
}

interface GlanceEntry {
  slot: SkillArtSlot;
  view: SkillInfoViewModel;
  enhanced: boolean;
}

/**
 * 한 렐릭의 네 칸 — 패시브 · 일반 공격 · 궁극기 · 폭주.
 *
 * 문장은 정보창의 스킬 쪽지와 **같은 조립기**(`buildSkillViewModel`·`buildFerocityViewModel`)에서 받는다.
 * 이 판이 제 문장을 지으면 같은 궁극기가 쪽지와 판에서 다른 수치로 읽힌다.
 */
function glanceEntries(ally: SkillGlanceAlly): GlanceEntry[] {
  const { def, breakthrough } = ally;
  const effect = (slot: SkillArtSlot): string | undefined => (breakthroughEnhances(def, breakthrough, slot) ? breakthroughEffectText(def, slot, def.stats) : undefined);
  const skills: [SkillArtSlot, Skill | Passive, number | undefined][] = [
    ["passive", { ...def.passive, power: def.passive.value, damageType: "physical" } as unknown as Skill, undefined],
    ["basic", def.basic, undefined],
    ["ultimate", def.ultimate, def.ultimate.cost],
  ];
  const entries: GlanceEntry[] = skills.map(([slot, skill, gaugeCost]) => ({
    slot,
    enhanced: breakthroughEnhances(def, breakthrough, slot),
    view: buildSkillViewModel({ def, breakthrough, kindLabel: skillSlotLabel(slot), skill, gaugeCost, slot, breakthroughEffect: effect(slot) }),
  }));
  entries.push({ slot: "ferocity", enhanced: breakthroughEnhances(def, breakthrough, "ferocity"), view: buildFerocityViewModel(def, { breakthroughEffect: effect("ferocity") }) });
  return entries;
}

/**
 * 전투 중 아군의 스킬을 한 판에 모아 읽는 창.
 *
 * 위 줄의 얼굴을 누르면 그 렐릭의 네 칸이 옆에서 밀려 들어온다. 칸은 튜토리얼의 궁극기 소개 쪽지와 같은 결 —
 * 어두운 유리 위에 윗변 한 줄, 왼쪽 스킬 액자, 오른쪽 이름과 본문 — 이고, 본문의 규칙어는 눌러서 읽는다.
 * 판이 떠 있는 동안 전투가 멈추는 것은 이 판이 아니라 전투 씬이 정한다(`anyPopupOpen`).
 * 닫는 길은 판 밖 우하단 뒤로가기와 판 밖 누르기 둘이다.
 */
export function openSkillGlancePopup(
  scene: Phaser.Scene,
  popups: PopupLayer,
  allies: readonly SkillGlanceAlly[],
  options: { reduceMotion: boolean; initial?: number; onClose?: () => void },
): void {
  if (allies.length === 0) return;
  const L = SKILL_GLANCE;
  const keywords = new KeywordManager(scene, popups);
  let selected = Math.min(Math.max(0, options.initial ?? 0), allies.length - 1);
  // **글자 크기와 판 높이는 아군 전원을 재서 한 번 정한다.** 얼굴을 바꿀 때마다 글자가 커졌다 작아지거나
  // 판이 늘었다 줄면 같은 판이 아니라 다른 창이 열린 것처럼 읽힌다. 내용이 짧으면 판도 그만큼 짧다.
  const { size, cardsHeight } = pickBodySize(scene, keywords, allies);
  const height = Math.min(L.height, L.cards.top + cardsHeight + L.cards.bottomPad);

  popups.open({
    width: L.width, height, y: L.centerY, title: t("battle.skillGlance.title"),
    dim: true, closeOnBackdrop: true, onClose: options.onClose,
  }, (body) => {
    const top = -height / 2;
    const tabs: { root: Phaser.GameObjects.Container; plate: Phaser.GameObjects.Graphics; name: Phaser.GameObjects.Text }[] = [];
    let cards: Phaser.GameObjects.Container | undefined;

    const paintTabs = (): void => {
      tabs.forEach((tab, index) => {
        const on = index === selected;
        tab.plate.setVisible(on);
        tab.root.setAlpha(on ? 1 : 0.5).setScale(on ? 1.06 : 0.94);
        tab.name.setColor(on ? COLOR.accentText : COLOR.ink);
      });
    };

    const showCards = (animate: boolean, direction: 1 | -1): void => {
      cards?.destroy(true);
      cards = buildCards(scene, keywords, allies[selected], top, size);
      body.add(cards);
      if (!animate || options.reduceMotion) return;
      cards.list.forEach((card, index) => {
        const node = card as Phaser.GameObjects.Container;
        const x = node.x;
        node.setAlpha(0).setX(x + L.slide.distance * direction);
        scene.tweens.add({ targets: node, alpha: 1, x, duration: L.slide.duration, delay: index * L.slide.stagger, ease: "Back.Out" });
      });
    };

    allies.forEach((ally, index) => {
      const root = scene.add.container(skillGlanceTabX(index, allies.length), top + L.tabs.y);
      const rarity = RARITY_TONE[ally.def.rarity];
      // 고른 얼굴만 뒤에 강조색 판이 서고 한 뼘 커진다 — 지금 누구의 칸을 읽는지가 판 하나로 말해진다.
      const plateShape = chipPoints(L.tabs.plate, L.tabs.plate, { bevel: { topLeft: 26, topRight: 0, bottomRight: 26, bottomLeft: 0 } });
      const plate = drawLayer(scene, 0, 0, plateShape, { fill: COLOR.accent, alpha: 0.2, edge: COLOR.accent, edgeWidth: 4, glow: { color: COLOR.accent, strength: 0.3, height: 0.7 } });
      root.add(plate);
      root.add(new FaceFrame(scene, 0, 0, { portraitAssetId: ally.def.portraitAssetId, size: L.tabs.face, color: rarity.chip }));
      const name = scene.add.text(0, L.tabs.nameGap, ally.def.name, textStyle({ role: "display", size: L.tabs.nameSize, color: COLOR.ink }))
        .setOrigin(0.5).setStroke("#05070a", 6);
      shrinkTextToWidth(name, L.tabs.gap - 24);
      root.add(name);
      const hit = scene.add.rectangle(0, L.tabs.nameGap / 2 - 6, L.tabs.plate, L.tabs.plate + L.tabs.nameGap, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(root));
      hit.on("pointerout", () => pressOut(root, "normal", { pop: false }));
      hit.on("pointerup", () => {
        pressOut(root);
        if (index === selected) return;
        const direction: 1 | -1 = index > selected ? 1 : -1;
        selected = index;
        paintTabs();
        showCards(true, direction);
      });
      root.add(hit);
      body.add(root);
      tabs.push({ root, plate, name });
    });
    paintTabs();
    showCards(!options.reduceMotion, 1);
  });
}

/** 칸 하나의 이름줄 높이. */
const nameHeight = (): number => Math.round(SKILL_GLANCE.cards.nameSize * 1.25);
/** 본문이 쓸 수 있는 폭. */
const bodyWidth = (): number => {
  const C = SKILL_GLANCE.cards;
  return SKILL_GLANCE.width - C.side * 2 - (C.pad + C.icon + C.textGap) - C.pad - 12;
};

function measureCards(scene: Phaser.Scene, keywords: KeywordManager, ally: SkillGlanceAlly, size: number): number {
  const bodies = glanceEntries(ally).map((entry) => layoutBody(keywords, entry.view, bodyWidth(), size));
  const total = bodies.reduce((sum, b) => sum + skillGlanceCardHeight(b.getData("height") as number, nameHeight()), 0) + SKILL_GLANCE.cards.gap * (bodies.length - 1);
  for (const b of bodies) b.destroy(true);
  void scene;
  return total;
}

/** 글자 사다리를 내려가며 아군 전원의 네 칸이 띠 안에 드는 가장 큰 글자를 고른다. 끝까지 넘치면 맨 아래 칸에서 멈춘다. */
function pickBodySize(scene: Phaser.Scene, keywords: KeywordManager, allies: readonly SkillGlanceAlly[]): { size: number; cardsHeight: number } {
  let pick = { size: SKILL_GLANCE.descSizes[0] as number, cardsHeight: 0 };
  for (const size of SKILL_GLANCE.descSizes) {
    const cardsHeight = Math.max(...allies.map((ally) => measureCards(scene, keywords, ally, size)));
    pick = { size, cardsHeight };
    if (cardsHeight <= skillGlanceCardRoom()) break;
  }
  return pick;
}

/** 한 렐릭의 네 칸을 판 안에 쌓는다. */
function buildCards(scene: Phaser.Scene, keywords: KeywordManager, ally: SkillGlanceAlly, top: number, size: number): Phaser.GameObjects.Container {
  const L = SKILL_GLANCE;
  const C = L.cards;
  const cardWidth = L.width - C.side * 2;
  const textLeft = C.pad + C.icon + C.textGap;
  const room = bodyWidth();
  const entries = glanceEntries(ally);
  const nameHeight = Math.round(C.nameSize * 1.25);
  const bodies = entries.map((entry) => layoutBody(keywords, entry.view, room, size));

  const root = scene.add.container(0, 0);
  let cursor = top + C.top;
  entries.forEach((entry, index) => {
    const descBody = bodies[index];
    const height = skillGlanceCardHeight(descBody.getData("height") as number, nameHeight);
    const card = scene.add.container(0, cursor + height / 2);
    const ferocity = entry.slot === "ferocity";
    const edge = ferocity ? FEROCITY_BADGE_TONE.edge : COLOR.accent;
    const shape = chipPoints(cardWidth, height, { bevel: { topLeft: 22, topRight: 0, bottomRight: 22, bottomLeft: 0 } });
    card.add(drawLayer(scene, 0, 0, shape, { fill: ferocity ? 0x160b09 : 0x0a0f17, alpha: 0.92, edge, edgeWidth: 4, glow: { color: edge, strength: 0.1, height: 0.5 } }));

    const left = -cardWidth / 2;
    const cardTop = -height / 2;
    const frame = addSkillIconFrame(scene, {
      size: C.icon, slot: entry.slot, relicId: ally.def.id, element: ally.def.element, role: ally.def.role,
      label: skillSlotLabel(entry.slot), enhanced: entry.enhanced,
      ...(ferocity ? { fallbackGlyph: "ferocity" as const, tone: FEROCITY_BADGE_TONE } : {}),
    });
    frame.setPosition(left + C.pad + C.icon / 2, cardTop + C.pad + C.icon / 2);
    card.add(frame);

    const name = scene.add.text(left + textLeft, cardTop + C.pad, entry.view.name, textStyle({ role: "display", size: C.nameSize, color: ferocity ? "#ffd9c4" : COLOR.accentText }))
      .setOrigin(0, 0).setStroke("#05070a", 6);
    // 궁극기·폭주는 이름 오른쪽에 채워야 하는 게이지 크기를 작게 붙인다 — 「얼마를 모아야 터지는가」.
    const gauge = entry.view.gaugeCost === undefined ? undefined
      : scene.add.text(0, cardTop + C.pad + nameHeight / 2, t("skill.gauge", { cost: entry.view.gaugeCost }), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5);
    const gaugeRoom = gauge ? gauge.width + 18 : 0;
    shrinkTextToWidth(name, room - gaugeRoom);
    card.add(name);
    if (gauge) { gauge.setX(left + textLeft + room); card.add(gauge); }

    descBody.setPosition(left + textLeft, cardTop + C.pad + nameHeight + C.nameGap);
    card.add(descBody);
    root.add(card);
    cursor += height + C.gap;
  });
  return root;
}

/** 본문(과 돌파로 붙은 노란 줄) 한 덩어리. 높이는 `height` 데이터로 함께 넘긴다. */
function layoutBody(keywords: KeywordManager, view: SkillInfoViewModel, width: number, size: number): Phaser.GameObjects.Container {
  const lineSpacing = Math.round(size * 0.28);
  const desc = keywords.layout(formatEffectDescription(view.description), skillKeywordLayoutOptions(view, { width, size, lineSpacing }));
  const box = desc.scene.add.container(0, 0);
  // 스킬 쪽지와 같은 요약 칩 줄(종류 · 범위 · 시간 · 효과 · 수치)이 본문 위에 선다.
  const tags = addSkillTagRow(desc.scene, skillSummaryTags(view), { width, size: Math.max(20, Math.round(size * 0.78)), keywords, contextualKeywords: view.contextualKeywords });
  const tagsHeight = tags.height > 0 ? tags.height + 14 : 0;
  box.add(tags);
  desc.setY(tagsHeight);
  box.add(desc);
  let height = tagsHeight + desc.height;
  if (view.breakthroughEffect !== undefined) {
    const extra = keywords.layout(formatEffectDescription(view.breakthroughEffect), skillKeywordLayoutOptions(view, { width, size: size - 1, lineSpacing, color: COLOR.accentText }));
    extra.setY(height + 12);
    box.add(extra);
    height += 12 + extra.height;
  }
  box.setData("height", height);
  return box;
}
