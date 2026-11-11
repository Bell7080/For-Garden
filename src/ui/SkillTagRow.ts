import Phaser from "phaser";
import { parseKeywordText, type KeywordDef } from "../data/keywords";
import type { KeywordManager } from "../managers/KeywordManager";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { SKILL_TAG_TONE, type SkillTag } from "./skillTags";
import { COLOR, textStyle } from "./theme";

/**
 * 스킬 요약 칩 한 줄(넘치면 여러 줄). 쪽지·튜토리얼이 같은 한 장을 쓴다.
 *
 * 칩은 상태 칩·라벨과 같은 결이다 — 왼쪽 위·오른쪽 아래만 깎인 어두운 유리 위에 갈래 색이 옅게
 * 물들고, 윗변 한 줄과 왼쪽 표식이 같은 색이다. 사방 외곽선은 두르지 않는다.
 *
 * 칩 안의 규칙어(`[[id|표기]]`)는 글자만 밑줄 긋지 않고 **칩 전체**가 그 뜻풀이를 연다 — 손가락이
 * 닿는 면이 글자 한 낱말이면 작은 칩에서 빗나간다.
 */
export const SKILL_TAG_ROW = {
  /** 칩 높이 = 글자 크기 × 이 비. */
  heightRatio: 1.72,
  gap: 10,
  rowGap: 10,
  /** 표식 칸 폭 = 글자 크기 × 이 비. */
  glyphRatio: 0.92,
  pad: 0.55,
} as const;

/** 갈래 색을 흰빛 쪽으로 당겨 글자 색으로 쓴다 — 칩 바탕과 같은 색이면 글이 묻힌다. */
function lighten(color: number, amount: number): string {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, "0")}`;
}

export interface SkillTagRowOptions {
  /** 칩이 넘치면 다음 줄로 내려가는 폭. */
  width: number;
  size: number;
  /** 있으면 규칙어가 든 칩을 눌러 뜻풀이를 연다. */
  keywords?: KeywordManager;
  contextualKeywords?: readonly KeywordDef[];
}

/** 원점은 첫 칩의 왼쪽 위다. 컨테이너 크기(`width`·`height`)가 실제로 쓴 자리다. */
export function addSkillTagRow(scene: Phaser.Scene, tags: readonly SkillTag[], options: SkillTagRowOptions): Phaser.GameObjects.Container {
  const row = scene.add.container(0, 0);
  const { size } = options;
  const height = Math.round(size * SKILL_TAG_ROW.heightRatio);
  const glyphRoom = Math.round(size * SKILL_TAG_ROW.glyphRatio);
  const pad = Math.round(size * SKILL_TAG_ROW.pad);
  let x = 0;
  let y = 0;
  let usedWidth = 0;
  for (const tag of tags) {
    const segments = parseKeywordText(tag.text, options.contextualKeywords);
    const plain = segments.map((segment) => segment.text).join("");
    const keyword = segments.find((segment) => segment.keyword)?.keyword;
    const tone = SKILL_TAG_TONE[tag.tone];
    const value = tag.tone === "value";
    // 수치 칩만 이름표(display)이고 나머지는 갈래 이름(emphasis)이다.
    const style = value
      ? textStyle({ role: "display", size, color: COLOR.accentText })
      : textStyle({ role: "emphasis", size, color: lighten(tone, 0.42) });
    const label = scene.add.text(0, 0, plain, style).setOrigin(0, 0.5);
    const width = Math.ceil(pad + glyphRoom + pad * 0.6 + label.width + pad * 1.1);
    if (x > 0 && x + width > options.width) { x = 0; y += height + SKILL_TAG_ROW.rowGap; }
    const chip = scene.add.container(x + width / 2, y + height / 2);
    const bevel = Math.round(height * 0.3);
    const shape = chipPoints(width, height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
    chip.add(drawLayer(scene, 0, 0, shape, { fill: 0x0b1018, alpha: 0.9, shadow: { x: 0, y: 3 } }));
    chip.add(drawLayer(scene, 0, 0, shape, { fill: tone, alpha: value ? 0.12 : 0.2, shadow: false, edge: tone, edgeAlpha: 0.9, edgeWidth: 2 }));
    const glyphX = -width / 2 + pad + glyphRoom / 2;
    chip.add(drawGlyph(scene, tag.glyph, glyphX, 0, Math.round(size * 0.86), tone, 1, Math.max(2, Math.round(size * 0.1))));
    label.setPosition(glyphX + glyphRoom / 2 + pad * 0.6, 0);
    chip.add(label);
    if (keyword && options.keywords) {
      // 눌러 열 수 있는 칩은 글자 아래에 같은 색 점선 한 줄을 둔다(본문의 밑줄 태그와 같은 약속).
      const underline = scene.add.graphics();
      underline.lineStyle(2, tone, 0.75);
      const lineY = label.height / 2 - 3;
      for (let dx = 0; dx < label.width; dx += 8) underline.lineBetween(label.x + dx, lineY, label.x + Math.min(dx + 4, label.width), lineY);
      chip.add(underline);
      const hit = scene.add.rectangle(0, 0, width, Math.max(height, 44), 0xffffff, 0).setInteractive({ useHandCursor: true });
      chip.add(hit);
      const manager = options.keywords;
      hit.on("pointerdown", () => pressIn(chip));
      hit.on("pointerout", () => pressOut(chip, "normal", { pop: false }));
      hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        pressOut(chip);
        manager.explain(keyword, { x: pointer.worldX, y: pointer.worldY - 20 }, options.contextualKeywords);
      });
    }
    row.add(chip);
    x += width + SKILL_TAG_ROW.gap;
    usedWidth = Math.max(usedWidth, x - SKILL_TAG_ROW.gap);
  }
  row.setSize(usedWidth, tags.length === 0 ? 0 : y + height);
  return row;
}
