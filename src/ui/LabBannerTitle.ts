/**
 * 연구소 모집판의 제목 블록과 배너 넘김 조작.
 *
 * 무엇을 세울지(결·제목·라벨)는 `labBannerPresentation.ts`가 정하고, 여기서는 그대로 그린다.
 * 제목은 **글자에 색을 흐르게** 하고 두꺼운 어두운 획과 아래로 떨어지는 그림자로 원화에서
 * 떼어 낸다 — 판을 받치면 모집 원화 위쪽이 통째로 어두운 상자가 된다(타이틀 로고와 같은 이유).
 * 긴 번역은 칸을 넓히지 않고 글자를 가로로 누른다(`squeezeTextToWidth`).
 */

import Phaser from "phaser";
import { t } from "../i18n";
import { drawHairline, drawLayer, slantedRect } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { LAB_TITLE } from "./labLayout";
import { BANNER_TONE, type BannerPresentation, type BannerTag } from "./labBannerPresentation";

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** 글자 높이를 따라 색이 흐르게 칠한다. Phaser Text는 캔버스 채우기를 그대로 받는다. */
function paintGradient(text: Phaser.GameObjects.Text, stops: readonly [string, string, string]): void {
  const gradient = text.context.createLinearGradient(0, 0, 0, text.height);
  gradient.addColorStop(0, stops[0]);
  gradient.addColorStop(0.55, stops[1]);
  gradient.addColorStop(1, stops[2]);
  text.setFill(gradient);
}

/**
 * 제목 블록 한 벌 — 눈썹 줄, 제목, 라벨 줄.
 *
 * 배너를 넘길 때마다 통째로 다시 세운다. 조각이 몇 개 안 되고, 라벨 수가 배너마다 달라
 * 갈아 끼우는 편이 자리 계산을 한 곳에 둔다.
 */
export function addBannerTitle(
  scene: Phaser.Scene,
  presentation: BannerPresentation,
  /** 이미 고른 제목 글자 — 픽업 배너면 그 렐릭의 이름이다(`BannerTitleSource`). */
  titleText: string,
  tags: readonly BannerTag[],
  options: { reduceMotion: boolean; depth: number },
): Phaser.GameObjects.Container {
  const tone = BANNER_TONE[presentation.tone];
  const root = scene.add.container(LAB_TITLE.x, 0).setDepth(options.depth);

  // 눈썹 줄 — 양옆으로 짧은 선이 뻗어 제목의 머리를 잡는다.
  const eyebrow = scene.add
    .text(0, LAB_TITLE.eyebrowY, t(presentation.eyebrowKey), textStyle({ role: "emphasis", size: 22, color: hex(tone.accent) }))
    .setOrigin(0.5)
    .setLetterSpacing(6)
    // 밝은 원화(디안의 창가) 위에서도 읽히도록 제목과 같은 어두운 획을 두른다.
    .setStroke("#0b0d12", 6);
  eyebrow.setShadow(0, 2, "#05070a", 6, false, true);
  const lineGap = eyebrow.width / 2 + 22;
  root.add([
    drawHairline(scene, -lineGap - 50, LAB_TITLE.eyebrowY, 100, { color: tone.accent, alpha: 0.85 }),
    drawHairline(scene, lineGap + 50, LAB_TITLE.eyebrowY, 100, { color: tone.accent, alpha: 0.85 }),
    eyebrow,
  ]);

  // 제목 — 아래로 떨어지는 검은 복제 한 겹 + 두꺼운 어두운 획 + 흐르는 색.
  const style = textStyle({ role: "display", size: presentation.titleSize });
  const shadow = scene.add.text(0, LAB_TITLE.titleY + 7, titleText, style).setOrigin(0.5)
    .setColor("#000000").setAlpha(0.55).setStroke("#000000", 16);
  const title = scene.add.text(0, LAB_TITLE.titleY, titleText, style).setOrigin(0.5)
    .setStroke("#0b0d12", 12);
  squeezeTextToWidth(title, LAB_TITLE.maxWidth);
  shadow.setScale(title.scaleX, title.scaleY);
  paintGradient(title, tone.gradient);
  root.add([shadow, title]);

  if (presentation.sparkles) root.add(addTitleSparkles(scene, title, tone.accent, options.reduceMotion));

  // 부제 — 픽업 개체를 꾸미는 한 줄. 제목 바로 아래에 결의 밝은 색으로 서고, 라벨 줄은 그만큼 내려선다.
  let tagY: number = LAB_TITLE.tagY;
  if (presentation.subtitleKey) {
    const subtitleY = LAB_TITLE.titleY + title.height / 2 + LAB_TITLE.subtitleGap;
    const subtitle = scene.add
      .text(0, subtitleY, t(presentation.subtitleKey), textStyle({ role: "emphasis", size: LAB_TITLE.subtitleFont, color: tone.gradient[0] }))
      .setOrigin(0.5)
      .setStroke("#0b0d12", 8);
    subtitle.setShadow(0, 3, "#05070a", 6, false, true);
    squeezeTextToWidth(subtitle, LAB_TITLE.maxWidth);
    root.add(subtitle);
    tagY = subtitleY + subtitle.height / 2 + LAB_TITLE.tagHeight / 2 + 18;
  }
  root.add(addTagRow(scene, tags, presentation, tagY));
  return root;
}

/**
 * 제목 양옆에서 반짝이는 마름모 넷.
 *
 * 난수를 쓰지 않고 자리를 박아 둔다. 동그라미가 아니라 마름모이며(화면 전체의 규칙), 움직임
 * 줄이기에서는 반짝이지 않고 옅게 서 있기만 한다.
 */
function addTitleSparkles(scene: Phaser.Scene, title: Phaser.GameObjects.Text, color: number, reduceMotion: boolean): Phaser.GameObjects.Container {
  const box = { half: (title.width * title.scaleX) / 2, top: LAB_TITLE.titleY - title.height / 2, bottom: LAB_TITLE.titleY + title.height / 2 };
  const spots = [
    { x: -box.half - 26, y: box.top + 8, size: 16, delay: 0 },
    { x: -box.half - 6, y: box.bottom - 10, size: 9, delay: 380 },
    { x: box.half + 22, y: box.top + 2, size: 11, delay: 190 },
    { x: box.half + 34, y: box.bottom - 18, size: 17, delay: 560 },
  ];
  const layer = scene.add.container(0, 0);
  for (const spot of spots) {
    const g = scene.add.graphics({ x: spot.x, y: spot.y }).setBlendMode(Phaser.BlendModes.ADD);
    const s = spot.size;
    g.fillStyle(color, 0.95);
    g.fillPoints([
      new Phaser.Math.Vector2(0, -s), new Phaser.Math.Vector2(s * 0.32, 0),
      new Phaser.Math.Vector2(0, s), new Phaser.Math.Vector2(-s * 0.32, 0),
    ], true);
    g.fillPoints([
      new Phaser.Math.Vector2(-s * 0.7, 0), new Phaser.Math.Vector2(0, -s * 0.22),
      new Phaser.Math.Vector2(s * 0.7, 0), new Phaser.Math.Vector2(0, s * 0.22),
    ], true);
    layer.add(g);
    if (reduceMotion) { g.setAlpha(0.7); continue; }
    g.setAlpha(0.25).setScale(0.6);
    scene.tweens.add({ targets: g, alpha: 1, scale: 1.1, duration: 620, delay: spot.delay, yoyo: true, repeat: -1, repeatDelay: 900, ease: "Sine.easeInOut" });
  }
  return layer;
}

/** 라벨 줄. 한 줄에 들지 않으면 두 줄로 나눠 가운데에 선다. */
function addTagRow(scene: Phaser.Scene, tags: readonly BannerTag[], presentation: BannerPresentation, tagY: number): Phaser.GameObjects.Container {
  const tone = BANNER_TONE[presentation.tone];
  const row = scene.add.container(0, 0);
  const chips = tags.map((tag) => buildTag(scene, tag, tone.tagFill, tone.accent));
  const lines: { chip: Phaser.GameObjects.Container; width: number }[][] = [[]];
  let lineWidth = 0;
  for (const chip of chips) {
    const width = chip.getData("width") as number;
    const current = lines[lines.length - 1];
    if (current.length > 0 && lineWidth + LAB_TITLE.tagGap + width > LAB_TITLE.maxWidth) {
      lines.push([]);
      lineWidth = 0;
    }
    lines[lines.length - 1].push({ chip, width });
    lineWidth += (lines[lines.length - 1].length > 1 ? LAB_TITLE.tagGap : 0) + width;
  }
  lines.forEach((line, index) => {
    const total = line.reduce((sum, { width }) => sum + width, 0) + LAB_TITLE.tagGap * (line.length - 1);
    let x = -total / 2;
    for (const { chip, width } of line) {
      chip.setPosition(x + width / 2, tagY + index * (LAB_TITLE.tagHeight + 12));
      x += width + LAB_TITLE.tagGap;
      row.add(chip);
    }
  });
  return row;
}

/**
 * 라벨 한 장 — 살짝 기운 판에 글자 하나.
 *
 * `accent`는 결의 강한 색으로 가득 칠하고(한정·1회), `primary`는 같은 색을 반투명하게, `plain`은
 * 어두운 유리다. 사방을 두르지 않고 윗변 강조선만 긋는다(화면 전체의 판 규칙).
 */
function buildTag(scene: Phaser.Scene, tag: BannerTag, fill: number, accent: number): Phaser.GameObjects.Container {
  const label = scene.add
    .text(0, 0, t(tag.key, tag.params), textStyle({ role: "emphasis", size: LAB_TITLE.tagFont, color: COLOR.ink }))
    .setOrigin(0.5);
  label.setShadow(0, 2, "#05070a", 4, false, true);
  const width = Math.round(label.width + LAB_TITLE.tagPadX * 2);
  const plate = tag.kind === "accent"
    ? { fill, alpha: 0.96, edge: 0xffffff, edgeAlpha: 0.55 }
    : tag.kind === "primary"
      ? { fill, alpha: 0.72, edge: accent, edgeAlpha: 0.9 }
      : { fill: 0x0c1016, alpha: 0.72, edge: accent, edgeAlpha: 0.45 };
  const chip = scene.add.container(0, 0);
  chip.add(drawLayer(scene, 3, 4, slantedRect(width, LAB_TITLE.tagHeight, 12), { fill: 0x000000, alpha: 0.4, shadow: false }));
  chip.add(drawLayer(scene, 0, 0, slantedRect(width, LAB_TITLE.tagHeight, 12), { ...plate, shadow: false }));
  chip.add(label);
  chip.setData("width", width);
  return chip;
}

/**
 * 배너 넘김 화살표 — 판때기가 아니라 얇은 꺾쇠.
 *
 * 연구 버튼과 같은 무게의 판을 세우면 모집 원화 양옆에 네모가 박혀 그림을 가린다. 옅은 유리
 * 한 장에 흰 꺾쇠 하나만 두고, 누르는 손맛은 공용 `pressIn`·`pressOut`이다.
 */
export function addBannerArrow(scene: Phaser.Scene, x: number, y: number, direction: -1 | 1, onClick: () => void): Phaser.GameObjects.Container {
  const { width, height, stroke } = LAB_TITLE.arrow;
  const arrow = scene.add.container(x, y);
  arrow.add(drawLayer(scene, 0, 0, slantedRect(width, height, 10), { fill: 0x0a0d12, alpha: 0.32, shadow: false }));
  const chevron = scene.add.graphics();
  const w = width * 0.2;
  const h = height * 0.2;
  const points = [new Phaser.Math.Vector2(-w * direction, -h), new Phaser.Math.Vector2(w * direction, 0), new Phaser.Math.Vector2(-w * direction, h)];
  // 아래로 민 검은 한 겹이 밝은 원화 위에서도 꺾쇠를 떼어 낸다.
  chevron.lineStyle(stroke + 2, 0x000000, 0.45);
  chevron.strokePoints(points.map((p) => new Phaser.Math.Vector2(p.x + 2, p.y + 3)), false);
  chevron.lineStyle(stroke, 0xffffff, 0.92);
  chevron.strokePoints(points, false);
  arrow.add(chevron);
  const hit = scene.add.rectangle(0, 0, width + 40, height + 40, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(arrow));
  hit.on("pointerout", () => pressOut(arrow, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(arrow); onClick(); });
  arrow.add(hit);
  return arrow;
}

/**
 * 몇 번째 배너인가 — 화살표 사이의 작은 마름모 줄.
 *
 * 지금 배너만 결의 색으로 길게 선다. 배너 수가 바뀌면(첫 복원 연구를 다 쓰면) 저절로 줄어든다.
 */
export function drawBannerPages(graphics: Phaser.GameObjects.Graphics, count: number, index: number, accent: number): void {
  graphics.clear();
  const { gap, size } = LAB_TITLE.pages;
  const total = (count - 1) * gap;
  for (let i = 0; i < count; i += 1) {
    const x = -total / 2 + i * gap;
    const active = i === index;
    const w = active ? size * 1.6 : size;
    const h = active ? size * 0.9 : size * 0.7;
    graphics.fillStyle(0x000000, 0.45);
    graphics.fillPoints([
      new Phaser.Math.Vector2(x + 2, -h + 3), new Phaser.Math.Vector2(x + w + 2, 3),
      new Phaser.Math.Vector2(x + 2, h + 3), new Phaser.Math.Vector2(x - w + 2, 3),
    ], true);
    graphics.fillStyle(active ? accent : 0xffffff, active ? 1 : 0.55);
    graphics.fillPoints([
      new Phaser.Math.Vector2(x, -h), new Phaser.Math.Vector2(x + w, 0),
      new Phaser.Math.Vector2(x, h), new Phaser.Math.Vector2(x - w, 0),
    ], true);
  }
}
