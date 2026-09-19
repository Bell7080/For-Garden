import { describe, expect, it } from "vitest";
import {
  canDigStrataTile, createArchaeologyState, createStrataBoard, digStrataTile,
  isStrataBoardFinished, nextStrataChargeAt, settleStrataCharges, strataBoardHaul, strataBoardView,
} from "../../src/core/strataDig";
import { DEFAULT_STRATA_LAYER_ID, findStrataLayer, STRATA_ART_COUNT, STRATA_CHARGE } from "../../src/data/strataLayers";
import { BACKGROUND_ASSETS } from "../../src/ui/backgroundAssets";
import { STRATA_ART, STRATA_BOARD, strataBoardFrame, strataLayerTextureKey, strataTileCenter, strataTileCrop } from "../../src/ui/strataBoardLayout";

const LAYER = findStrataLayer(DEFAULT_STRATA_LAYER_ID)!;

/** 값 하나만 계속 돌려주는 난수. */
const constant = (value: number) => () => value;

describe("지층 탐사판", () => {
  it("은 정의한 칸 수와 발굴 횟수를 그대로 쓴다", () => {
    const board = createStrataBoard({ layerId: LAYER.id, random: constant(0.5) });
    expect(board.tiles).toHaveLength(LAYER.columns * LAYER.rows);
    expect(board.digsLeft).toBe(LAYER.digs);
    // 횟수가 칸 수보다 적어야 「어디를 팔까」가 선택이 된다.
    expect(board.digsLeft).toBeLessThan(board.tiles.length);
  });

  it("은 모든 칸을 구역 하나에 붙인다", () => {
    const board = createStrataBoard({ layerId: LAYER.id, random: constant(0.37) });
    for (const tile of board.tiles) expect(board.zones[tile.zone]).toBeDefined();
  });

  it("의 화면 판에는 열지 않은 칸의 내용이 담기지 않는다", () => {
    const board = createStrataBoard({ layerId: LAYER.id, random: constant(0.5) });
    const view = strataBoardView(board);
    // 화면 모델 하나만으로 짧은 `현재/총 횟수` 표기를 완성할 수 있어야 한다.
    expect(view.digsMax).toBe(LAYER.digs);
    // 담기면 화면을 뜯어보는 것만으로 어디에 무엇이 있는지 알 수 있다.
    for (const tile of view.tiles) {
      expect(tile.kind).toBeUndefined();
      expect(tile.amount).toBeUndefined();
      // 구역은 보인다 — 색이 곧 이 콘텐츠가 주는 유일한 단서다.
      expect(tile.zone).toBe(board.tiles[tile.index].zone);
    }
  });

  it("은 판 뒤에 연 칸만 내용을 내려보낸다", () => {
    const board = createStrataBoard({ layerId: LAYER.id, random: constant(0.5) });
    const dug = digStrataTile(board, 7);
    const view = strataBoardView(dug.board);
    expect(view.tiles[7].kind).toBe(dug.tile.kind);
    expect(view.tiles[6].kind).toBeUndefined();
    expect(view.digsLeft).toBe(LAYER.digs - 1);
  });

  it("은 같은 칸을 두 번 팔 수 없다", () => {
    const board = createStrataBoard({ layerId: LAYER.id, random: constant(0.5) });
    const dug = digStrataTile(board, 3).board;
    expect(canDigStrataTile(dug, 3)).toBe(false);
    expect(() => digStrataTile(dug, 3)).toThrow();
  });

  it("은 횟수를 다 쓰면 남은 칸이 있어도 끝난다", () => {
    let board = createStrataBoard({ layerId: LAYER.id, random: constant(0.5) });
    for (let index = 0; index < LAYER.digs; index += 1) board = digStrataTile(board, index).board;
    expect(board.digsLeft).toBe(0);
    expect(isStrataBoardFinished(board)).toBe(true);
    expect(board.tiles.some((tile) => !tile.revealed)).toBe(true);
  });

  it("은 이번 판에서 캔 것을 종류별로 한 줄씩 합친다", () => {
    let board = createStrataBoard({ layerId: LAYER.id, random: constant(0.5) });
    for (let index = 0; index < 4; index += 1) board = digStrataTile(board, index).board;
    const haul = strataBoardHaul(strataBoardView(board));
    // 빈 흙은 줄을 만들지 않는다 — 아무것도 얻지 못한 칸이 목록에 서면 얻은 것으로 읽힌다.
    expect(haul.some(({ kind }) => kind === "empty")).toBe(false);
    expect(new Set(haul.map(({ kind }) => kind)).size).toBe(haul.length);
  });
});

describe("탐사 횟수", () => {
  it("은 가득 찬 채로 시작한다", () => {
    expect(createArchaeologyState().charges).toBe(STRATA_CHARGE.max);
  });

  it("은 끝난 구간만 채우고 남은 구간을 기준 시각에 보존한다", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const later = new Date(start.getTime() + STRATA_CHARGE.intervalMs * 2.5);
    const settled = settleStrataCharges(0, start.toISOString(), later);
    expect(settled.charges).toBe(2);
    // 남은 반 구간을 잃지 않도록 기준을 두 구간 뒤로만 옮긴다.
    expect(Date.parse(settled.updatedAt)).toBe(start.getTime() + STRATA_CHARGE.intervalMs * 2);
  });

  it("은 상한을 넘겨 쌓이지 않는다", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const far = new Date(start.getTime() + STRATA_CHARGE.intervalMs * 999);
    expect(settleStrataCharges(0, start.toISOString(), far).charges).toBe(STRATA_CHARGE.max);
  });

  it("은 가득 차면 다음 충전 시각을 말하지 않는다", () => {
    expect(nextStrataChargeAt(STRATA_CHARGE.max, "2026-01-01T00:00:00Z")).toBeNull();
    expect(nextStrataChargeAt(1, "2026-01-01T00:00:00Z")).toBe(new Date(Date.parse("2026-01-01T00:00:00Z") + STRATA_CHARGE.intervalMs).toISOString());
  });
});

describe("탐사판 배치", () => {
  const FRAME = strataBoardFrame(LAYER.columns, LAYER.rows, 1080);

  it("은 정사각 셀로 자리 안에 든다", () => {
    // 원화 비율은 cover 크롭이 지키고, 입력 격자는 정사각형을 지킨다.
    expect(FRAME.cellWidth).toBeCloseTo(FRAME.cellHeight, 5);
    expect(FRAME.width).toBeLessThanOrEqual(STRATA_BOARD.maxWidth + 0.001);
    expect(FRAME.height).toBeLessThanOrEqual(STRATA_BOARD.bottom - STRATA_BOARD.top + 0.001);
  });

  it("의 칸들은 틈 없이 붙어 판을 남김없이 나눈다", () => {
    // 칸 사이에 틈이 있으면 땅이 아니라 타일 바닥이 된다.
    expect(FRAME.cellWidth * LAYER.columns).toBeCloseTo(FRAME.width, 5);
    expect(FRAME.cellHeight * LAYER.rows).toBeCloseTo(FRAME.height, 5);
    const first = strataTileCenter(0, LAYER.columns, FRAME);
    const second = strataTileCenter(1, LAYER.columns, FRAME);
    expect(second.x - first.x).toBeCloseTo(FRAME.cellWidth, 5);
  });

  it("의 칸들은 판 안에서 서로 겹치지 않는다", () => {
    const centers = Array.from({ length: LAYER.columns * LAYER.rows }, (_, index) => strataTileCenter(index, LAYER.columns, FRAME));
    for (const { x, y } of centers) {
      expect(Math.abs(x) + FRAME.cellWidth / 2).toBeLessThanOrEqual(FRAME.width / 2 + 0.001);
      expect(Math.abs(y) + FRAME.cellHeight / 2).toBeLessThanOrEqual(FRAME.height / 2 + 0.001);
    }
    expect(new Set(centers.map(({ x, y }) => `${x.toFixed(3)}:${y.toFixed(3)}`)).size).toBe(centers.length);
  });

  it("의 잘라내기는 원화를 남김없이 덮고 서로 겹치지 않는다", () => {
    // 조각을 따로 굽지 않고 같은 원화를 칸마다 잘라 쓰므로, 잘린 자리가 곧 칸이다.
    const crops = Array.from({ length: LAYER.columns * LAYER.rows }, (_, index) => strataTileCrop(index, LAYER.columns, LAYER.rows));
    const area = crops.reduce((sum, crop) => sum + crop.width * crop.height, 0);
    // 기본 크롭은 정사각 판을 cover하는 원본 중앙 영역만 남긴다.
    expect(area).toBeCloseTo(STRATA_ART.width * STRATA_ART.width, 3);
    for (const crop of crops) {
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.width).toBeLessThanOrEqual(STRATA_ART.width + 0.001);
      expect(crop.y + crop.height).toBeLessThanOrEqual(STRATA_ART.height + 0.001);
    }
    // 첫 줄 두 칸은 가로로 붙어 있고 아랫줄은 딱 한 칸 아래다.
    expect(crops[1].x).toBeCloseTo(crops[0].x + crops[0].width, 5);
    expect(crops[LAYER.columns].y).toBeCloseTo(crops[0].y + crops[0].height, 5);
  });

  it("의 겉장 키는 판이 들고 있는 번호를 그대로 쓴다", () => {
    for (let art = 1; art <= STRATA_ART_COUNT; art += 1) {
      const key = strataLayerTextureKey(art);
      expect(BACKGROUND_ASSETS.some(([assetKey]) => assetKey === key), key).toBe(true);
    }
  });

  it("은 판을 열 때 겉장을 하나 뽑아 그대로 들고 다닌다", () => {
    // 화면이 그릴 때마다 고르면 탭을 오갈 때마다 파던 땅의 그림이 바뀐다.
    const board = createStrataBoard({ layerId: LAYER.id, random: constant(0.5) });
    expect(board.art).toBeGreaterThanOrEqual(1);
    expect(board.art).toBeLessThanOrEqual(STRATA_ART_COUNT);
    expect(strataBoardView(digStrataTile(board, 0).board).art).toBe(board.art);
  });
});
