import { describe, expect, it } from "vitest";
import { composeStrataFog, strataFogFields } from "../../src/core/strataFog";
import { strataLegend } from "../../src/core/strataLegend";
import { createStrataBoard, digStrataTile, strataBoardHaul, strataBoardView, strataHaulKey, strataRuneRarityOdds } from "../../src/core/strataDig";
import { RUNE_TRAIT_ITEMS } from "../../src/data/runeTraits";
import { STRATA_LAYERS, STRATA_RUNE_TILES, type StrataZoneTone } from "../../src/data/strataLayers";
import { STRATA_LEGEND, STRATA_BOARD, STRATA_STAGE, strataBoardFrame, strataBracketBoxes, strataHaulLayout, strataLegendFrame, strataStageFrame } from "../../src/ui/strataBoardLayout";
import { STRATA_FOG_TONE } from "../../src/ui/strataTones";
import { strataRewardTier } from "../../src/ui/strataRewardPopStyle";

/** 시드를 주는 작은 난수. 같은 씨앗이면 같은 판이 나온다. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const KNOWN_ITEMS = new Set<string>([RUNE_TRAIT_ITEMS.grant.itemId, RUNE_TRAIT_ITEMS.grantHigh.itemId, RUNE_TRAIT_ITEMS.upgrade.itemId]);

describe("탐사 보상표", () => {
  it("에는 꽝이 없고 소량의 골드·원석과 치즈케이크가 있다", () => {
    for (const layer of STRATA_LAYERS) {
      expect(layer.rewards.some((row) => row.kind === "empty"), layer.id).toBe(false);
      expect(layer.rewards.some((row) => row.kind === "cheesecake"), layer.id).toBe(true);
      // 같은 종류가 소량·보통 두 줄로 서서 꽝 자리를 메운다.
      expect(layer.rewards.filter((row) => row.kind === "gold").length, layer.id).toBeGreaterThanOrEqual(2);
      expect(layer.rewards.filter((row) => row.kind === "rawStone").length, layer.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("으로 만든 판에는 빈 칸이 하나도 없고 모든 칸이 실제 보상을 든다", () => {
    for (const layer of STRATA_LAYERS) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const board = createStrataBoard({ layerId: layer.id, random: seeded(seed * 7919) });
        for (const tile of board.tiles) {
          expect(tile.kind, `${layer.id}#${seed}`).not.toBe("empty");
          expect(tile.amount).toBeGreaterThan(0);
        }
      }
    }
  });

  it("은 한 판에 룬 칸을 정해진 범위로만 깐다", () => {
    for (const layer of STRATA_LAYERS) {
      for (let seed = 1; seed <= 60; seed += 1) {
        const board = createStrataBoard({ layerId: layer.id, random: seeded(seed * 104729) });
        const runes = board.tiles.filter((tile) => tile.kind === "rune").length;
        expect(runes, `${layer.id}#${seed}`).toBeGreaterThanOrEqual(STRATA_RUNE_TILES.min);
        expect(runes, `${layer.id}#${seed}`).toBeLessThanOrEqual(STRATA_RUNE_TILES.max);
      }
    }
  });

  it("은 판을 만들 때 룬의 등급·자리와 연구 재료의 아이템을 함께 정한다", () => {
    const board = createStrataBoard({ layerId: "abyss", random: seeded(99) });
    for (const tile of board.tiles) {
      if (tile.kind === "rune") {
        expect(tile.runeRarity).toBeDefined();
        expect([0, 1, 2]).toContain(tile.runePart);
      }
      if (tile.kind === "researchItem") expect(KNOWN_ITEMS.has(tile.itemId ?? "")).toBe(true);
      // 룬이 아닌 칸에 룬 필드가 새지 않는다.
      if (tile.kind !== "rune") expect(tile.runeRarity).toBeUndefined();
    }
  });

  it("의 룬 등급은 대부분 고급·희귀이고 영웅·전설은 화석·호박석과 같은 확률이다", () => {
    for (const layer of STRATA_LAYERS) {
      for (const tone of ["soil", "teal", "gold", "deep"] as StrataZoneTone[]) {
        const odds = strataRuneRarityOdds(layer, tone);
        const total = layer.rewards.reduce((sum, row) => sum + row.weight[tone], 0);
        const chance = (kind: string): number => layer.rewards.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.weight[tone], 0) / total;
        expect(odds.epic).toBeCloseTo(chance("fossil"), 10);
        expect(odds.legendary).toBeCloseTo(chance("amber"), 10);
        expect(odds.uncommon + odds.rare + odds.epic + odds.legendary).toBeCloseTo(1, 10);
        expect(odds.uncommon + odds.rare).toBeGreaterThan(0.85);
      }
    }
  });

  it("의 화면 판은 연 칸의 룬 등급만 내려보내고 닫힌 칸은 숨긴다", () => {
    const board = createStrataBoard({ layerId: "surface", random: seeded(5) });
    const runeIndex = board.tiles.find((tile) => tile.kind === "rune")!.index;
    const closed = strataBoardView(board);
    expect(closed.tiles[runeIndex].runeRarity).toBeUndefined();
    expect(closed.tiles[runeIndex].itemId).toBeUndefined();
    const opened = strataBoardView(digStrataTile(board, runeIndex).board);
    expect(opened.tiles[runeIndex].runeRarity).toBe(board.tiles[runeIndex].runeRarity);
    expect(opened.tiles[runeIndex].runePart).toBe(board.tiles[runeIndex].runePart);
  });

  it("의 전리품은 룬을 등급별로, 연구 재료를 아이템별로 가른다", () => {
    let board = createStrataBoard({ layerId: "abyss", random: seeded(11) });
    for (let index = 0; index < board.tiles.length; index += 1) board = digStrataTile({ ...board, digsLeft: 99 }, index).board;
    const haul = strataBoardHaul(strataBoardView(board));
    const keys = haul.map(strataHaulKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of haul) {
      if (entry.kind === "rune") expect(entry.runeRarity).toBeDefined();
      if (entry.kind === "researchItem") expect(KNOWN_ITEMS.has(entry.itemId ?? "")).toBe(true);
    }
  });

  it("의 전리품은 같은 등급이라도 번호가 다른 룬 조각을 다른 칸으로 가른다", () => {
    const keys = [0, 1, 2].map((runePart) => strataHaulKey({ kind: "rune", runeRarity: "rare", runePart: runePart as 0 | 1 | 2 }));
    expect(new Set(keys).size).toBe(3);
    expect(strataHaulKey({ kind: "gold" })).not.toBe(strataHaulKey({ kind: "rune", runeRarity: "rare", runePart: 0 }));
  });

  it("의 화려함은 화석·호박석과 귀한 룬에서 커진다", () => {
    expect(strataRewardTier({ kind: "gold" })).toBe("common");
    expect(strataRewardTier({ kind: "rune", runeRarity: "rare" })).toBe("common");
    expect(strataRewardTier({ kind: "fossil" })).toBe("shine");
    expect(strataRewardTier({ kind: "rune", runeRarity: "epic" })).toBe("shine");
    expect(strataRewardTier({ kind: "amber" })).toBe("legend");
    expect(strataRewardTier({ kind: "rune", runeRarity: "legendary" })).toBe("legend");
  });
});

describe("안개 밭", () => {
  const columns = 5; const rows = 5; const resolution = 12;
  const toneOfTile: StrataZoneTone[] = Array.from({ length: columns * rows }, (_, index) => (index % columns < 2 ? "teal" : index % columns < 4 ? "soil" : "deep"));
  const none = Array.from({ length: columns * rows }, () => false);

  it("은 흙빛에는 밭을 만들지 않고 나머지 색만 0~1 알파로 깐다", () => {
    const fog = strataFogFields({ columns, rows, toneOfTile, revealed: none, resolution });
    expect(fog.fields.soil).toBeUndefined();
    expect(fog.width).toBe(columns * resolution);
    for (const tone of ["teal", "deep"] as const) {
      const field = fog.fields[tone]!;
      expect(field.length).toBe(fog.width * fog.height);
      for (const value of field) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1 + 1e-6); }
    }
  });

  it("의 가장자리는 이웃 구역으로 스며든다(칸 경계에서 계단이 지지 않는다)", () => {
    const fog = strataFogFields({ columns, rows, toneOfTile, revealed: none, resolution });
    const field = fog.fields.teal!;
    const y = Math.floor(fog.height / 2);
    const values = Array.from({ length: fog.width }, (_, x) => field[y * fog.width + x]);
    // 청록 구역 한가운데는 짙고 흙빛 쪽으로 갈수록 서서히 옅어진다.
    expect(values[Math.floor(resolution * 0.9)]).toBeGreaterThan(0.85);
    const middle = values.filter((value) => value > 0.1 && value < 0.9).length;
    expect(middle).toBeGreaterThanOrEqual(resolution * 0.25);
    // 조각 사이 최대 변화가 한 칸 계단(1)보다 훨씬 부드럽다.
    const steps = values.slice(1).map((value, x) => Math.abs(value - values[x]));
    expect(Math.max(...steps)).toBeLessThan(0.5);
  });

  it("은 판 칸의 안개를 걷어 낸다", () => {
    const revealed = none.map((_, index) => index === 0 || index === 1 || index === 5 || index === 6);
    const before = strataFogFields({ columns, rows, toneOfTile, revealed: none, resolution }).fields.teal!;
    const after = strataFogFields({ columns, rows, toneOfTile, revealed, resolution }).fields.teal!;
    const at = (field: Float32Array, cellX: number, cellY: number): number => field[(cellY * resolution + resolution / 2) * columns * resolution + cellX * resolution + resolution / 2];
    expect(at(after, 0, 0)).toBeLessThan(at(before, 0, 0) - 0.3);
    // 멀리 떨어진 청록 칸은 거의 그대로다.
    expect(at(after, 1, 4)).toBeGreaterThan(0.6);
  });

  it("의 두 겹은 서로 다른 경계를 그린다", () => {
    const a = strataFogFields({ columns, rows, toneOfTile, revealed: none, resolution, warp: { amplitude: 0.16, frequency: 1.7, phase: 0 } }).fields.teal!;
    const b = strataFogFields({ columns, rows, toneOfTile, revealed: none, resolution, warp: { amplitude: 0.24, frequency: 2.4, phase: 2.1 } }).fields.teal!;
    let differing = 0;
    for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > 0.05) differing += 1;
    expect(differing).toBeGreaterThan(0);
  });

  it("은 같은 입력에서 늘 같은 그림을 낸다", () => {
    const wideSoil: StrataZoneTone[] = Array.from({ length: columns * rows }, (_, index) => (index % columns === 0 ? "teal" : index % columns === 4 ? "deep" : "soil"));
    const a = composeStrataFog(strataFogFields({ columns, rows, toneOfTile: wideSoil, revealed: none, resolution }), STRATA_FOG_TONE);
    const b = composeStrataFog(strataFogFields({ columns, rows, toneOfTile: wideSoil, revealed: none, resolution }), STRATA_FOG_TONE);
    expect(Array.from(a)).toEqual(Array.from(b));
    // 흙빛 한가운데는 거의 투명하고, 청록 한가운데는 눈에 띈다.
    const width = columns * resolution;
    const alphaAt = (x: number, y: number): number => a[(y * width + x) * 4 + 3];
    const midY = Math.floor(rows * resolution / 2);
    expect(alphaAt(Math.floor(width / 2), midY)).toBeLessThan(20);
    expect(alphaAt(Math.floor(resolution / 2), midY)).toBeGreaterThan(60);
  });
});

describe("색 범례", () => {
  it("는 판에 깔린 색마다 한 줄을 세우고 세 가지까지만 보여 준다", () => {
    for (const layer of STRATA_LAYERS) {
      const rows = strataLegend(layer, ["deep", "soil", "gold", "teal"]);
      expect(rows.map((row) => row.tone)).toEqual(["soil", "teal", "gold", "deep"]);
      for (const row of rows) { expect(row.kinds.length).toBeGreaterThan(0); expect(row.kinds.length).toBeLessThanOrEqual(3); }
      expect(strataLegend(layer, ["teal"])).toHaveLength(1);
    }
  });

  it("는 깊은 색에서 귀한 것이 기운다고 말하고 흙빛에서는 흔한 것을 보여 준다", () => {
    const layer = STRATA_LAYERS[0];
    const [soil, , , deep] = strataLegend(layer, ["soil", "teal", "gold", "deep"]);
    expect(deep.kinds.some((kind) => kind === "gems" || kind === "amber" || kind === "fossil" || kind === "researchItem")).toBe(true);
    expect(soil.kinds.some((kind) => kind === "gold" || kind === "rawStone")).toBe(true);
  });
});

describe("판 옆 범례와 전리품 배치", () => {
  it.each([[5, 5], [6, 5], [5, 6], [6, 6]])("%d×%d 판은 범례와 겹치지 않고 화면 안에 선다", (columns, rows) => {
    const frame = strataBoardFrame(columns, rows, 1080);
    const legend = strataLegendFrame(frame, 4, 1080);
    expect(frame.centerX + frame.width / 2).toBeLessThan(legend.left);
    expect(frame.centerX - frame.width / 2).toBeGreaterThanOrEqual(STRATA_BOARD.left);
    expect(legend.left + legend.width).toBeLessThanOrEqual(1080 - STRATA_BOARD.left + 1e-6);
    // 색이 넷이어도 판의 높이 안에 든다.
    expect(legend.height).toBeLessThanOrEqual(frame.height);
    expect(legend.rowTops).toHaveLength(4);
    expect(legend.top + legend.height).toBeLessThanOrEqual(frame.centerY + frame.height / 2 + 1e-6);
    expect(STRATA_LEGEND.icon * 3 + 8).toBeLessThanOrEqual(STRATA_LEGEND.width - 12);
  });

  it.each([0, 1, 3, 6, 8, 10, 12])("전리품 %d칸은 서로 겹치지 않고 화면 폭 안에 선다", (count) => {
    const layout = strataHaulLayout(count, 1080);
    expect(layout.xs).toHaveLength(count);
    layout.xs.forEach((x, index) => {
      expect(x - layout.frame / 2).toBeGreaterThanOrEqual(0);
      expect(x + layout.frame / 2).toBeLessThanOrEqual(1080);
      if (index > 0) expect(x - layout.xs[index - 1]).toBeGreaterThanOrEqual(layout.frame);
    });
  });
});

describe("안개 경계선", () => {
  it("은 구역 경계에서 가장 밝고 짙어 어디까지가 한 구역인지 읽힌다", () => {
    const columns = 6; const rows = 3; const resolution = 16;
    const tone: StrataZoneTone[] = Array.from({ length: columns * rows }, (_, index) => (index % columns < 3 ? "teal" : "soil"));
    const none = tone.map(() => false);
    const pixels = composeStrataFog(strataFogFields({ columns, rows, toneOfTile: tone, revealed: none, resolution }), STRATA_FOG_TONE);
    const width = columns * resolution; const y = Math.floor(rows * resolution / 2);
    const at = (x: number): { alpha: number; red: number } => ({ alpha: pixels[(y * width + x) * 4 + 3], red: pixels[(y * width + x) * 4] });
    const boundary = 3 * resolution; // 청록 3칸이 끝나는 자리
    const edge = at(boundary); const inside = at(boundary - 2 * resolution);
    expect(edge.alpha).toBeGreaterThan(inside.alpha);
    expect(edge.red).toBeGreaterThan(inside.red);
    // 바깥(흙빛 쪽 깊은 곳)에는 안개가 없다.
    expect(at(boundary + 2 * resolution).alpha).toBeLessThan(10);
  });
});

describe("발굴판 무대 장식", () => {
  const overlap = (a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }): boolean =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  it.each([[5, 5], [6, 5], [5, 6], [6, 6]])("%d×%d 판의 모서리 표식은 판 테두리·범례·굴착 게이지와 겹치지 않는다", (columns, rows) => {
    const frame = strataBoardFrame(columns, rows, 1080);
    const stage = strataStageFrame(frame, 1080);
    const outer = STRATA_STAGE.frameOuter;
    const boardBox = { left: frame.centerX - frame.width / 2 - outer, right: frame.centerX + frame.width / 2 + outer, top: frame.centerY - frame.height / 2 - outer, bottom: frame.centerY + frame.height / 2 + outer };
    const legend = strataLegendFrame(frame, 4, 1080);
    const legendBox = { left: legend.left, right: legend.left + legend.width, top: legend.top, bottom: legend.top + legend.height };
    // 굴착 게이지 판(장면 상수와 같은 값): 가운데 y 284, 높이 92.
    const gaugeBox = { left: 0, right: 1080, top: 284 - 46, bottom: 284 + 46 };
    for (const bracket of stage.brackets) {
      for (const box of strataBracketBoxes(bracket)) {
        expect(overlap(box, boardBox), "판 테두리").toBe(false);
        expect(overlap(box, legendBox), "범례").toBe(false);
        expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(1080);
      }
    }
    expect(stage.top).toBeGreaterThanOrEqual(gaugeBox.bottom - STRATA_STAGE.gap - 1);
  });
});
