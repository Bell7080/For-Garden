import Phaser from "phaser";
import { STORY_DIFFICULTY, type StoryDifficulty } from "../core/storyDifficulty";
import { t } from "../i18n";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, drawShapeOutline } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { textStyle } from "./theme";

/** 난이도의 무게 — 아이콘·고르기 칸의 마름모가 몇 개 차오르는가. */
export const STORY_DIFFICULTY_RANK: Readonly<Record<StoryDifficulty, number>> = { easy: 1, normal: 2, hard: 3 };

/**
 * 난이도 아이콘 — 지도 왼쪽에 서는 한 칸. 위에 난이도만큼 마름모가 차오르고(쉬움 하나 · 어려움 셋) 아래에 이름이
 * 선다. 칸 색이 곧 지금 난이도의 색이라 지도를 훑는 눈에도 어느 사다리에 서 있는지가 남는다.
 */
// 스토리 지도의 상단 줄은 프로필 없이 재화만 오른쪽에 서므로 왼쪽 위가 빈다 — 지도 노드와 겹치지 않는 그 자리에 앉는다.
export const STORY_DIFFICULTY_ICON = { x: 96, y: 96, size: 112 } as const;

export function addStoryDifficultyIcon(scene: Phaser.Scene, difficulty: StoryDifficulty, onClick: () => void): Phaser.GameObjects.Container {
  const { x, y, size } = STORY_DIFFICULTY_ICON;
  const tone = STORY_DIFFICULTY[difficulty];
  const icon = scene.add.container(x, y);
  const bevel = size * 0.2;
  const shape = chipPoints(size, size, { bevel: { topLeft: bevel, bottomRight: bevel } });
  icon.add(drawLayer(scene, 0, 0, shape, { fill: tone.fill, alpha: 0.94, edge: tone.color, edgeAlpha: 0.9 }));
  icon.add(drawShapeOutline(scene, 0, 0, shape, { color: tone.color, alpha: 0.85, width: 3 }));
  icon.add(addRankPips(scene, 0, -size * 0.16, size * 0.2, STORY_DIFFICULTY_RANK[difficulty], tone.color));
  icon.add(scene.add.text(0, size * 0.24, t(`storyDifficulty.${difficulty}`), textStyle({ role: "display", size: 24, color: tone.text })).setOrigin(0.5).setStroke("#05070a", 5));
  // 열리는 것이 있다는 표시 — 오른쪽 아래 깎인 모서리 안쪽의 작은 ▾.
  icon.add(drawGlyph(scene, "caret-down", size * 0.3, -size * 0.36, 16, tone.color, 0.9));
  const hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(icon));
  hit.on("pointerout", () => pressOut(icon, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(icon); onClick(); });
  icon.add(hit);
  return icon;
}

/** 난이도 마름모 셋 — 차오른 수가 그 난이도의 무게다. 동그라미 대신 화면 전체의 납작한 마름모를 쓴다. */
export function addRankPips(scene: Phaser.Scene, x: number, y: number, pip: number, rank: number, color: number): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics({ x, y });
  const step = pip * 0.92;
  for (let index = 0; index < 3; index += 1) {
    const cx = (index - 1) * step;
    const lit = index < rank;
    const half = pip / 2;
    const points = [new Phaser.Math.Vector2(cx, -half), new Phaser.Math.Vector2(cx + half * 0.78, 0), new Phaser.Math.Vector2(cx, half), new Phaser.Math.Vector2(cx - half * 0.78, 0)];
    graphics.fillStyle(0x000000, 0.55).fillPoints(points.map((point) => new Phaser.Math.Vector2(point.x + 2, point.y + 3)), true);
    graphics.fillStyle(lit ? color : 0x2a313b, lit ? 1 : 0.9).fillPoints(points, true);
    if (lit) graphics.fillStyle(0xffffff, 0.35).fillPoints([points[0], points[1], new Phaser.Math.Vector2(cx, 0), points[3]], true);
  }
  return graphics;
}

