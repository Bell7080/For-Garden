import Phaser from "phaser";
import { colorAssistPolicy, type ColorAssistPattern, type SemanticColorKind } from "../core/settings";
import { textStyle } from "./theme";

/** 1.3배 글자와 무관하게 의미 표식을 카드 모서리에 고정하는 순수 배치 상수다. */
export const COLOR_ASSIST_LAYOUT = {
  card: { inset: 14, size: 30 }, statusChip: { inset: 5, size: 18 }, affinity: { offsetX: 31, size: 20 }, reward: { inset: 7, size: 22 },
} as const;

/** 색 의미가 있는 우선 화면 목록. 새 소비처 검수와 회귀 테스트가 같은 정적 장부를 읽는다. */
export const COLOR_ASSIST_SURFACES = [
  { id: "battle-status-chip", kind: "status", anchor: "top-left" },
  { id: "relic-card-and-info", kind: "rarity/element", anchor: "top-corners" },
  { id: "party-affinity", kind: "status", anchor: "left-platform" },
  { id: "reward-frame", kind: "status", anchor: "top-left" },
] as const;

/** 점·사선·교차선을 작은 고정 면 안에 그려 기존 의미색 위에 비색상 채널을 더한다. */
export function drawAssistPattern(scene: Phaser.Scene, x: number, y: number, size: number, pattern: ColorAssistPattern): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics({ x, y });
  if (pattern === "none") return graphics;
  graphics.lineStyle(1.5, 0xffffff, 0.9).fillStyle(0xffffff, 0.88);
  if (pattern === "dots") for (let py = -size / 3; py <= size / 3; py += size / 3) for (let px = -size / 3; px <= size / 3; px += size / 3) graphics.fillCircle(px, py, 1.5);
  else {
    for (let offset = -size; offset <= size; offset += size / 3) graphics.lineBetween(-size / 2, offset + size / 2, size / 2, offset - size / 2);
    if (pattern === "crosshatch") for (let offset = -size; offset <= size; offset += size / 3) graphics.lineBetween(-size / 2, offset - size / 2, size / 2, offset + size / 2);
  }
  return graphics;
}

/** 정책 결과만 렌더하며, off이면 빈 컨테이너라 기존 픽셀과 객체 흐름을 건드리지 않는다. */
export function addColorAssistMark(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, size: number, enabled: boolean, kind: SemanticColorKind, value: string): Phaser.GameObjects.Container | undefined {
  const policy = colorAssistPolicy(enabled, kind, value);
  if (policy.pattern === "none") return undefined;
  const mark = scene.add.container(x, y);
  mark.add(drawAssistPattern(scene, 0, 0, size, policy.pattern));
  mark.add(scene.add.text(0, 0, policy.glyph, textStyle({ role: "display", size: Math.round(size * 0.62), color: "#ffffff" })).setOrigin(0.5).setStroke("#05070a", 3));
  parent.add(mark);
  return mark;
}
