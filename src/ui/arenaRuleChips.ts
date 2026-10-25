import Phaser from "phaser";
import { t } from "../i18n";
import type { ArenaRules } from "../core/liveArena";
import { drawLayer, slantedRect } from "./holo";
import { ARENA_TONE } from "./arenaTheme";
import { textStyle } from "./theme";

/** 아레나 규칙 넷. 설정 창의 줄·요청 띠·대기 판이 같은 순서·같은 그림으로 말한다. */
export type ArenaRuleKind = "ban" | "order" | "placement" | "unique";

const P = (x: number, y: number): Phaser.Geom.Point => new Phaser.Geom.Point(x, y);

/**
 * 규칙 하나의 그림 — 밴은 마름모를 긋는 X, 순서는 겹친 꺾쇠 둘, 배치는 가운데가 한 걸음 나선 세 칸,
 * 중복은 겹친 카드 두 장이다. 동그라미를 쓰지 않는 아이콘 결을 따르고 크기에 비례해 그린다.
 */
export function drawArenaRuleIcon(scene: Phaser.Scene, kind: ArenaRuleKind, x: number, y: number, size: number, color: number, alpha = 1): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const r = size / 2, line = Math.max(2, size * 0.1);
  g.lineStyle(line, color, alpha);
  switch (kind) {
    case "ban":
      g.strokePoints([P(0, -r), P(r * 0.9, 0), P(0, r), P(-r * 0.9, 0)], true);
      g.lineBetween(-r * 0.36, -r * 0.36, r * 0.36, r * 0.36);
      g.lineBetween(r * 0.36, -r * 0.36, -r * 0.36, r * 0.36);
      break;
    case "order":
      [-0.42, 0.22].forEach((dx, i) => {
        g.fillStyle(color, alpha * (i === 0 ? 0.55 : 1));
        g.fillPoints([P(r * dx - r * 0.3, -r * 0.8), P(r * dx + r * 0.08, -r * 0.8), P(r * dx + r * 0.62, 0), P(r * dx + r * 0.08, r * 0.8), P(r * dx - r * 0.3, r * 0.8), P(r * dx + r * 0.24, 0)], true);
      });
      break;
    case "placement":
      [[-0.66, 0.2], [0, -0.28], [0.66, 0.2]].forEach(([dx, dy], i) => {
        const s = r * 0.5;
        g.fillStyle(color, alpha * (i === 1 ? 1 : 0.6));
        g.fillPoints([P(r * dx, r * dy - s), P(r * dx + s * 0.8, r * dy), P(r * dx, r * dy + s), P(r * dx - s * 0.8, r * dy)], true);
      });
      g.lineBetween(-r * 0.9, r * 0.82, r * 0.9, r * 0.82);
      break;
    case "unique":
      g.fillStyle(color, alpha * 0.4);
      g.fillPoints([P(-r * 0.85, -r * 0.6), P(r * 0.15, -r * 0.6), P(r * 0.15, r * 0.75), P(-r * 0.85, r * 0.75)], true);
      g.strokePoints([P(-r * 0.15, -r * 0.85), P(r * 0.85, -r * 0.85), P(r * 0.85, r * 0.5), P(-r * 0.15, r * 0.5)], true);
      break;
  }
  return g;
}

/** 규칙의 짧은 이름표 — 칩에 서는 한 마디. 비공개 배치에서는 중복 칩이 뜻이 없어 세우지 않는다. */
export function arenaRuleChipLabels(rules: ArenaRules): { kind: ArenaRuleKind; label: string }[] {
  const order = { first: t("arena.rules.first"), second: t("arena.rules.second"), random: t("arena.rules.random") }[rules.order];
  return [
    { kind: "ban" as const, label: rules.ban ? t("arena.rules.oneBan") : t("arena.rules.noBan") },
    { kind: "order" as const, label: t("arena.chip.order", { order }) },
    { kind: "placement" as const, label: rules.placement === "alternate" ? t("arena.rules.alternate") : t("arena.rules.hidden") },
    ...(rules.placement === "alternate" ? [{ kind: "unique" as const, label: rules.unique === false ? t("arena.chip.duplicatesAllowed") : t("arena.chip.duplicatesBlocked") }] : []),
  ];
}

/**
 * 규칙 칩 한 줄 — 그림 + 한 마디를 담은 보랏빛 칩이 가운데로 모여 선다. 글로 「각 1밴 · 교차 배치」를 이어 적던
 * 때는 무엇이 몇 개의 규칙인지가 읽히지 않았다. 칩이 `maxWidth`를 넘으면 두 줄로 나눈다.
 */
export function addArenaRuleChips(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, rules: ArenaRules, options: { size?: number; maxWidth?: number } = {}): Phaser.GameObjects.Container {
  const size = options.size ?? 24, height = Math.round(size * 2.1), icon = Math.round(size * 1.15), gap = Math.round(size * 0.55);
  const root = scene.add.container(x, y);
  parent.add(root);
  const chips = arenaRuleChipLabels(rules).map(({ kind, label }) => {
    const text = scene.add.text(0, 0, label, textStyle({ role: "emphasis", size, color: ARENA_TONE.accentText })).setOrigin(0, 0.5);
    const width = Math.round(text.width + icon + size * 1.9);
    const chip = scene.add.container(0, 0);
    chip.add(drawLayer(scene, 0, 0, slantedRect(width, height, height * 0.32), { fill: 0x241238, alpha: 0.94, edge: ARENA_TONE.accent, edgeAlpha: 0.75 }));
    chip.add(drawArenaRuleIcon(scene, kind, -width / 2 + size * 0.75 + icon / 2, 0, icon, ARENA_TONE.accent));
    text.setX(-width / 2 + size * 0.95 + icon);
    chip.add(text);
    return { chip, width };
  });
  const maxWidth = options.maxWidth ?? Infinity;
  const rows: { chip: Phaser.GameObjects.Container; width: number }[][] = [[]];
  let used = 0;
  for (const entry of chips) {
    const next = used + (used > 0 ? gap : 0) + entry.width;
    if (used > 0 && next > maxWidth) { rows.push([]); used = 0; }
    rows[rows.length - 1].push(entry);
    used += (used > 0 ? gap : 0) + entry.width;
  }
  rows.forEach((row, index) => {
    const total = row.reduce((sum, entry) => sum + entry.width, 0) + gap * (row.length - 1);
    let left = -total / 2;
    const rowY = (index - (rows.length - 1) / 2) * (height + gap * 0.6);
    row.forEach((entry) => { entry.chip.setPosition(left + entry.width / 2, rowY); root.add(entry.chip); left += entry.width + gap; });
  });
  return root;
}

/** 아직 남은 시간을 `0:42`처럼 적는다. 아레나 요청·대기 판의 시계가 같은 양식이다. */
export function arenaClockText(deadline: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

