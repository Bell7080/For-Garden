import type { ContentId } from "../core/contentUnlock";

/**
 * 연구원 레벨업 판의 자리 — Phaser를 모르는 순수 배치표.
 *
 * 위에서부터 **영웅 줄(애착 렐릭 SD + LV.n › LV.m) → 레벨업 보상(액자) → 새로 열린 것(그림 칸)** 순이다.
 * 판 높이는 손으로 적지 않고 열린 것의 줄 수에서 거꾸로 구한다 — 한꺼번에 여러 레벨이 오르면 칸이 늘어난다.
 */
export const LEVEL_UP_POPUP = {
  width: 900,
  /** 제목표 아래 첫 줄까지. */
  topRoom: 96,
  hero: {
    height: 300,
    sd: { x: -270, groundRatio: 0.92, height: 230, shadow: 180 },
    /** 「LV.n ›」 작은 줄 · 큰 LV · 「연구원 레벨 +k」 줄의 세로 자리(영웅 줄 위끝 기준). */
    levelX: 90,
    fromY: 62,
    toY: 158,
    gainY: 256,
    fromSize: 40,
    toSize: 118,
    gainSize: 28,
    /** 큰 LV 둘레에 반짝이는 네 갈래 별 — 큰 LV 가운데 기준 상대 자리와 크기. */
    sparkles: [
      { x: -170, y: -58, size: 18 }, { x: 168, y: -66, size: 24 }, { x: 196, y: 30, size: 14 },
      { x: -150, y: 46, size: 13 }, { x: 40, y: -92, size: 11 },
    ],
  },
  section: { titleSize: 26, titleRoom: 66, gap: 26 },
  reward: {
    frame: 128, spacing: 72, captionGap: 34, captionSize: 22, captionWidth: 220,
    /** 스테미나 상한 액자 뒤의 「MAX」 무늬 — 스테미나 그림과 같은 연두 계열을 옅게. */
    limitColor: "#9be86a", limitAlpha: 0.38,
  },
  unlock: { width: 190, height: 196, gapX: 18, gapY: 18, perRow: 4, glyph: 74, glyphY: -26, avatar: 104, nameY: 64, nameSize: 23 },
  /** 아이콘 칸 · 로비 버튼 · 출격판 칸 세 무리 사이의 간격. */
  groupGap: 30,
  /** 로비의 원근 버튼(교류·발굴·결투) — 로비와 같은 판을 같은 비율로 한 줄에 셋까지. */
  lobby: { scale: 0.9, perRow: 3, gapX: 20, gapY: 20 },
  /** 출격판의 원화 칸(대작전·현상수배·레이드·원정) — 출격판과 같은 폭·비율로 길게. 대작전·현상수배는 출격판처럼 한 줄에 나란히 선다. */
  sortie: { scale: 0.95, pairGap: 16, gapY: 20 },
  bottomRoom: 48,
  /** 판이 화면(1920)을 넘지 않는 높이. 넘으면 버튼·출격판 칸만 같은 비율로 줄인다(아이콘 칸은 그대로). */
  maxHeight: 1760,
  minShrink: 0.6,
} as const;

/**
 * 열린 콘텐츠가 판에서 서는 모양. 입구가 아이콘인 콘텐츠는 칸(`tile`), 로비의 원근 버튼이 입구면 그 버튼(`lobby`),
 * 출격판의 원화 칸이 입구면 그 칸(`sortie`)을 **원본 크기·비율 그대로** 세운다(값은 로비·출격판과 같다).
 */
export const LEVEL_UP_ENTRANCE: Partial<Record<ContentId, { kind: "lobby" | "sortie"; width: number; height: number; split?: "left" | "right" }>> = {
  interaction: { kind: "lobby", width: 292, height: 106 },
  excavation: { kind: "lobby", width: 292, height: 106 },
  duel: { kind: "lobby", width: 292, height: 106 },
  cakeOperation: { kind: "sortie", width: 392, height: 200, split: "left" },
  bounty: { kind: "sortie", width: 392, height: 200, split: "right" },
  raid: { kind: "sortie", width: 800, height: 200 },
  expedition: { kind: "sortie", width: 800, height: 230 },
};

/** 판에 세울 열린 것 하나 — 콘텐츠 ID, 또는 테두리(`frame`). */
export type LevelUpUnlockKey = ContentId | "frame";

export interface LevelUpUnlockPlacement {
  /** 넘긴 목록에서의 자리. */
  index: number;
  kind: "tile" | "lobby" | "sortie";
  /** 「새로 열린 것」 제목 아래 첫 줄 위끝 기준의 가운데 자리. */
  x: number;
  y: number;
  /** 원본에 곱할 배율(칸은 1). */
  scale: number;
}

/**
 * 열린 것을 **아이콘 칸 → 로비 버튼 → 출격판 칸** 세 무리로 갈라 위에서부터 쌓는다. 무리 안의 차례는 넘긴 차례(여는 레벨)다.
 */
export function levelUpUnlockPlan(keys: readonly LevelUpUnlockKey[], shrink = levelUpShrink(keys)): { placements: LevelUpUnlockPlacement[]; height: number } {
  const { unlock, groupGap } = LEVEL_UP_POPUP;
  const lobby = { ...LEVEL_UP_POPUP.lobby, scale: LEVEL_UP_POPUP.lobby.scale * shrink };
  const sortie = { ...LEVEL_UP_POPUP.sortie, scale: LEVEL_UP_POPUP.sortie.scale * shrink };
  const placements: LevelUpUnlockPlacement[] = [];
  const entrance = (key: LevelUpUnlockKey) => (key === "frame" ? undefined : LEVEL_UP_ENTRANCE[key]);
  const indexed = keys.map((key, index) => ({ key, index, spec: entrance(key) }));
  const tiles = indexed.filter((item) => item.spec === undefined);
  const lobbies = indexed.filter((item) => item.spec?.kind === "lobby");
  const sorties = indexed.filter((item) => item.spec?.kind === "sortie");
  let y = 0;
  const startGroup = (): void => { if (y > 0) y += groupGap; };

  if (tiles.length > 0) {
    levelUpUnlockCells(tiles.length).forEach((cell, order) => {
      placements.push({ index: tiles[order]!.index, kind: "tile", x: cell.x, y: cell.row * (unlock.height + unlock.gapY) + unlock.height / 2, scale: 1 });
    });
    const rows = Math.ceil(tiles.length / unlock.perRow);
    y = rows * unlock.height + (rows - 1) * unlock.gapY;
  }
  if (lobbies.length > 0) {
    startGroup();
    for (let start = 0; start < lobbies.length; start += lobby.perRow) {
      const row = lobbies.slice(start, start + lobby.perRow);
      const widths = row.map((item) => item.spec!.width * lobby.scale);
      const height = Math.max(...row.map((item) => item.spec!.height * lobby.scale));
      let x = -(widths.reduce((a, b) => a + b, 0) + (row.length - 1) * lobby.gapX) / 2;
      row.forEach((item, order) => {
        placements.push({ index: item.index, kind: "lobby", x: x + widths[order]! / 2, y: y + height / 2, scale: lobby.scale });
        x += widths[order]! + lobby.gapX;
      });
      y += height + (start + lobby.perRow < lobbies.length ? lobby.gapY : 0);
    }
  }
  if (sorties.length > 0) {
    startGroup();
    // 갈라 선 칸(대작전·현상수배)은 둘이 함께 열리면 출격판처럼 한 줄에 맞붙는다.
    const rows: Array<typeof sorties> = [];
    sorties.forEach((item) => {
      const last = rows[rows.length - 1];
      if (item.spec!.split && last?.length === 1 && last[0]!.spec!.split && last[0]!.spec!.split !== item.spec!.split) last.push(item);
      else rows.push([item]);
    });
    rows.forEach((row, rowIndex) => {
      const ordered = [...row].sort((a, b) => (a.spec!.split === "left" ? -1 : 0) - (b.spec!.split === "left" ? -1 : 0));
      const height = Math.max(...ordered.map((item) => item.spec!.height)) * sortie.scale;
      const total = ordered.reduce((sum, item) => sum + item.spec!.width * sortie.scale, 0) + (ordered.length - 1) * sortie.pairGap;
      let x = -total / 2;
      ordered.forEach((item) => {
        const width = item.spec!.width * sortie.scale;
        placements.push({ index: item.index, kind: "sortie", x: x + width / 2, y: y + height / 2, scale: sortie.scale });
        x += width + sortie.pairGap;
      });
      y += height + (rowIndex < rows.length - 1 ? sortie.gapY : 0);
    });
  }
  return { placements, height: y };
}

export function levelUpRewardHeight(): number {
  const { section, reward } = LEVEL_UP_POPUP;
  return section.titleRoom + reward.frame + reward.captionGap + reward.captionSize;
}

export function levelUpUnlockHeight(keys: readonly LevelUpUnlockKey[], shrink = levelUpShrink(keys)): number {
  if (keys.length === 0) return 0;
  const { section } = LEVEL_UP_POPUP;
  return section.gap + section.titleRoom + levelUpUnlockPlan(keys, shrink).height;
}

export function levelUpPopupHeight(keys: readonly LevelUpUnlockKey[], shrink = levelUpShrink(keys)): number {
  const L = LEVEL_UP_POPUP;
  return L.topRoom + L.hero.height + L.section.gap + levelUpRewardHeight() + levelUpUnlockHeight(keys, shrink) + L.bottomRoom;
}

/**
 * 한꺼번에 많이 열려 판이 화면을 넘을 때 버튼·출격판 칸에 곱할 배율. 비율은 그대로 두고 크기만 줄인다 —
 * 판을 화면 밖으로 내보내면 닫는 손이 판 위를 누르는지 밖을 누르는지 흐려진다.
 */
export function levelUpShrink(keys: readonly LevelUpUnlockKey[]): number {
  const { maxHeight, minShrink } = LEVEL_UP_POPUP;
  let shrink = 1;
  while (shrink > minShrink && levelUpPopupHeight(keys, shrink) > maxHeight) shrink = Math.round((shrink - 0.02) * 100) / 100;
  return shrink;
}

/** 열린 것 칸들의 가운데 자리. 마지막 줄은 남은 칸만큼 가운데로 모인다. */
export function levelUpUnlockCells(count: number): Array<{ x: number; row: number }> {
  const { unlock } = LEVEL_UP_POPUP;
  const cells: Array<{ x: number; row: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / unlock.perRow);
    const inRow = Math.min(unlock.perRow, count - row * unlock.perRow);
    const column = index - row * unlock.perRow;
    const total = inRow * unlock.width + (inRow - 1) * unlock.gapX;
    cells.push({ x: -total / 2 + unlock.width / 2 + column * (unlock.width + unlock.gapX), row });
  }
  return cells;
}
