import Phaser from "phaser";
import { drawGlyph, type GlyphName } from "./glyphs";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { UI_ICON } from "./icons";
import { COLOR, textStyle } from "./theme";
import { squeezeTextToWidth } from "./textFit";

/**
 * 유적 미리보기 창의 위아래 조각(응태 2026-11-23).
 *
 * 예전에는 판 규격이 창 맨 위 한 줄 흐린 글(「5×5 · 굴착 8회 · 권장 LV.1」)이었고, 들어갈 수
 * 있는지는 버튼 위에 떠 있는 맨 글자(「탐사 가능」)였다 — 둘 다 판의 무게가 없어 기대 획득 판
 * 사이에서 곁말로 읽혔다. 판 크기·굴착 횟수는 **같은 크기의 칸 둘**, 해금 레벨은 몸판 윗변
 * 오른쪽에 걸터앉는 **표식 하나**, 지금 들어갈 수 있는지와 그 시간은 **시간 레이어 한 장**이 맡는다.
 */

const DARK = "#05070a";
/** 들어갈 수 있는 상태의 색 — 기대 획득 판의 강조선과 같은 금빛이다. */
const READY = COLOR.accent;

export interface SiteSpecCellOptions {
  width: number;
  height: number;
  /** 무엇을 세는 칸인가. 판 크기는 작은 격자, 굴착은 곡괭이 그림이 선다. */
  kind: "board" | "digs";
  value: string;
  /** 결정이 더해 준 굴착처럼 값에 얹는 몫. 결정색으로 값 옆에 선다. */
  bonus?: string;
  label: string;
  /** 판 크기 칸이 그리는 격자의 칸 수. */
  grid?: { columns: number; rows: number };
}

/** 판 규격 칸 하나 — 왼쪽 그림, 오른쪽 위 작은 이름표, 그 아래 크게 선 값. */
export function addSiteSpecCell(scene: Phaser.Scene, x: number, y: number, options: SiteSpecCellOptions): Phaser.GameObjects.Container {
  const cell = scene.add.container(x, y);
  const { width, height } = options;
  const shape = chipPoints(width, height, { bevel: { topLeft: height * 0.3, bottomRight: height * 0.3 } });
  cell.add(drawLayer(scene, 0, 0, shape, { fill: 0x0b1116, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.55, shadow: { x: 4, y: 7 } }));

  const icon = height * 0.56;
  const iconX = -width / 2 + 34 + icon / 2;
  if (options.kind === "digs") {
    // 판 안의 남은 굴착 게이지와 같은 곡괭이다 — 같은 수를 같은 그림이 말한다.
    cell.add(scene.add.image(iconX + 3, 5, UI_ICON.pickaxe).setDisplaySize(icon, icon).setTint(0x000000).setAlpha(0.55));
    cell.add(scene.add.image(iconX, 0, UI_ICON.pickaxe).setDisplaySize(icon, icon));
  } else {
    cell.add(drawBoardGrid(scene, iconX, 0, icon, options.grid ?? { columns: 5, rows: 5 }));
  }

  const textX = iconX + icon / 2 + 22;
  const room = width / 2 - 24 - textX;
  cell.add(squeezeTextToWidth(scene.add.text(textX, -height * 0.2, options.label,
    textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5), room));
  const value = scene.add.text(textX, height * 0.16, options.value,
    textStyle({ role: "display", size: 42, color: COLOR.ink })).setOrigin(0, 0.5).setStroke(DARK, 6);
  cell.add(value);
  if (options.bonus) {
    cell.add(scene.add.text(textX + value.width + 10, height * 0.18, options.bonus,
      textStyle({ role: "emphasis", size: 26, color: "#dcc8ff" })).setOrigin(0, 0.5).setStroke(DARK, 5));
  }
  return cell;
}

/** 판 크기 칸의 그림 — 그 유적의 칸 수 그대로 그은 작은 격자. 숫자와 같은 말을 모양으로 한 번 더 한다. */
function drawBoardGrid(scene: Phaser.Scene, x: number, y: number, size: number, grid: { columns: number; rows: number }): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const cell = size / Math.max(grid.columns, grid.rows);
  const w = cell * grid.columns; const h = cell * grid.rows;
  const left = -w / 2; const top = -h / 2;
  g.fillStyle(0x000000, 0.5).fillRect(left + 3, top + 5, w, h);
  for (let r = 0; r < grid.rows; r += 1) {
    for (let c = 0; c < grid.columns; c += 1) {
      // 판의 흙빛 칸처럼 몇 칸만 옅게 밝혀 격자가 무늬가 아니라 칸으로 읽히게 한다.
      const lit = (r * 3 + c * 5) % 7 === 0;
      g.fillStyle(lit ? COLOR.accent : 0x2a2f36, lit ? 0.85 : 0.95).fillRect(left + c * cell + 1.5, top + r * cell + 1.5, cell - 3, cell - 3);
    }
  }
  g.lineStyle(2, COLOR.accent, 0.9).strokeRect(left, top, w, h);
  return g;
}

/** 해금 레벨 표식 — 몸판 윗변 오른쪽에 걸터앉는 깎인 칩. 잠긴 유적이면 붉고 자물쇠가 선다. */
export function addSiteUnlockTag(scene: Phaser.Scene, x: number, y: number, options: { width: number; height: number; label: string; unlocked: boolean }): Phaser.GameObjects.Container {
  const tag = scene.add.container(x, y);
  const { width, height, unlocked } = options;
  const shape = chipPoints(width, height, { bevel: { topLeft: height * 0.42, bottomRight: height * 0.42 } });
  tag.add(drawLayer(scene, 0, 0, shape, unlocked
    ? { fill: 0x2a2212, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 1, edgeWidth: 3, shadow: { x: 4, y: 6 } }
    : { fill: 0x2a1012, alpha: 0.96, edge: COLOR.danger, edgeAlpha: 1, edgeWidth: 3, shadow: { x: 4, y: 6 } }));
  const glyphSize = height * 0.46;
  const glyphX = -width / 2 + 24 + glyphSize / 2;
  tag.add(drawGlyph(scene, unlocked ? "check" : "lock", glyphX, 0, glyphSize, unlocked ? COLOR.accent : COLOR.danger, 1, 3));
  const textX = glyphX + glyphSize / 2 + 10;
  tag.add(squeezeTextToWidth(scene.add.text(textX, 0, options.label,
    textStyle({ role: "display", size: 26, color: unlocked ? COLOR.accentText : COLOR.dangerText })).setOrigin(0, 0.5).setStroke(DARK, 5),
  width / 2 - 18 - textX));
  return tag;
}

export type SiteStatusState = "ready" | "cooling" | "locked" | "noCharge";

export interface SiteStatusLayerOptions {
  width: number;
  height: number;
  state: SiteStatusState;
  /** 크게 서는 한 마디(「탐사 가능」 · 「재탐사까지」 · 「최소 LV.6 필요」). */
  title: string;
  /** 재탐사까지 남은 시간처럼 제목 옆에 크게 서는 시계. 초마다 `setTime`으로 고친다. */
  time?: string;
  /** 오른쪽 끝의 작은 한 줄 — 탐사 후 잠기는 시간. */
  note?: string;
}

const STATUS_GLYPH: Record<SiteStatusState, GlyphName> = {
  ready: "check", cooling: "tag-duration", locked: "lock", noCharge: "tag-duration",
};

/**
 * 시간 레이어 — 들어갈 수 있는지와 그 시간을 한 장이 말한다.
 *
 * 들어갈 수 있으면 금빛, 못 들어가면 붉게 물들고, 기다리는 중이면 남은 시간이 시계처럼 크게 선다.
 * 오른쪽 끝의 작은 줄은 **이 유적을 파면 몇 시간 잠기는가**다 — 지금 조작을 바꾸지는 않지만 어느
 * 유적을 먼저 팔지 고르는 데 쓰는 수라 흐리게 붙인다.
 */
export function addSiteStatusLayer(scene: Phaser.Scene, x: number, y: number, options: SiteStatusLayerOptions):
{ container: Phaser.GameObjects.Container; setTime: (time: string) => void } {
  const layer = scene.add.container(x, y);
  const { width, height, state } = options;
  const ready = state === "ready";
  const tone = ready ? READY : COLOR.danger;
  const shape = chipPoints(width, height, { bevel: { topLeft: height * 0.32, bottomRight: height * 0.32 } });
  layer.add(drawLayer(scene, 0, 0, shape, {
    fill: ready ? 0x14120c : 0x160c0d, alpha: 0.94, edge: tone, edgeAlpha: 0.9, edgeWidth: 3,
    glow: { color: tone, strength: 0.22, height: 0.7 },
  }));

  // 왼쪽 그림 판 — 상태마다 다른 그림이 같은 자리에 선다.
  const badge = height * 0.62;
  const badgeX = -width / 2 + 28 + badge / 2;
  const badgeShape = chipPoints(badge, badge, { bevel: { topLeft: badge * 0.24, bottomRight: badge * 0.24 } });
  layer.add(drawLayer(scene, badgeX, 0, badgeShape, { fill: 0x05070a, alpha: 0.85, shadow: false }));
  layer.add(drawGlyph(scene, STATUS_GLYPH[state], badgeX, 0, badge * 0.56, tone, 1, 3));

  const textX = badgeX + badge / 2 + 20;
  const note = options.note
    ? scene.add.text(width / 2 - 30, 0, options.note, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5)
    : null;
  const noteRoom = note ? Math.min(note.width, width * 0.34) + 24 : 0;
  if (note) layer.add(squeezeTextToWidth(note, width * 0.34));

  const titleColor = ready ? COLOR.accentText : COLOR.dangerText;
  const title = scene.add.text(textX, options.time ? -height * 0.2 : 0, options.title,
    options.time ? textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim }) : textStyle({ role: "display", size: 34, color: titleColor }))
    .setOrigin(0, 0.5).setStroke(DARK, 5);
  const room = width / 2 - 30 - noteRoom - textX;
  layer.add(squeezeTextToWidth(title, room));
  const time = options.time !== undefined
    ? scene.add.text(textX, height * 0.16, options.time, textStyle({ role: "display", size: 38, color: titleColor })).setOrigin(0, 0.5).setStroke(DARK, 6)
    : null;
  if (time) layer.add(time);
  return { container: layer, setTime: (value) => { time?.setText(value); } };
}
