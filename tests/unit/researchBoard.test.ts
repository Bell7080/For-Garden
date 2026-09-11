import { describe, expect, it } from "vitest";
import { RESEARCH_BOARD, researchBoardLayout, researchBoardRows } from "../../src/ui/researchBoardLayout";
import { CRACK_BRANCHES, FOSSIL_CRACK, crackBranchPoints, fossilShards, shardPoints } from "../../src/ui/fossilCrack";
import { researchSlotViews } from "../../src/core/researchPresentation";
import type { PullResultDto } from "../../src/api/contracts";
import type { RelicRarity } from "../../src/core/types";

const VIEW_WIDTH = 1080;
const NAV_TOP = 1920 - 180;

describe("연구 결과판 배치", () => {
  it("열 칸을 가운데가 가장 긴 세 줄로 나눈다", () => {
    // 다섯씩 두 줄은 칸이 작아지고 화면 위아래가 통째로 빈다. 넉 줄은 마지막에 한 칸만 남는다.
    expect(researchBoardRows(10)).toEqual([3, 4, 3]);
    expect(researchBoardRows(1)).toEqual([1]);
    expect(researchBoardRows(4)).toEqual([4]);
    expect(researchBoardRows(0)).toEqual([]);
    // 어떤 수를 넣어도 한 줄이 최대 칸 수를 넘지 않고 합이 보존된다.
    for (let count = 1; count <= 24; count += 1) {
      const rows = researchBoardRows(count);
      expect(Math.max(...rows)).toBeLessThanOrEqual(RESEARCH_BOARD.maxColumns);
      expect(rows.reduce((sum, row) => sum + row, 0)).toBe(count);
    }
  });

  it("칸이 화면 좌우 여백 안에 들고 서로 겹치지 않는다", () => {
    const board = researchBoardLayout(10, VIEW_WIDTH);
    expect(board.cells).toHaveLength(10);
    for (const cell of board.cells) {
      expect(cell.x - board.tileWidth / 2).toBeGreaterThanOrEqual(RESEARCH_BOARD.sideMargin);
      expect(cell.x + board.tileWidth / 2).toBeLessThanOrEqual(VIEW_WIDTH - RESEARCH_BOARD.sideMargin);
    }
    // 같은 줄에서 이웃한 두 칸 사이는 정확히 규정 여백이다.
    const row = board.cells.filter((cell) => cell.row === 1);
    for (let index = 1; index < row.length; index += 1) {
      expect(row[index].x - row[index - 1].x - board.tileWidth).toBeCloseTo(RESEARCH_BOARD.columnGap, 5);
    }
    // 줄과 줄 사이도 마찬가지다. 돌출 머리가 없는 칸이라 여기에 따로 여유를 두지 않는다.
    const rows = [0, 1, 2].map((index) => board.cells.find((cell) => cell.row === index)!.y);
    expect(rows[1] - rows[0] - board.tileHeight).toBeCloseTo(RESEARCH_BOARD.rowGap, 5);
    expect(rows[2] - rows[1]).toBeCloseTo(rows[1] - rows[0], 5);
  });

  it("줄이 짧아도 가운데를 지켜 판이 좌우로 기울지 않는다", () => {
    const board = researchBoardLayout(10, VIEW_WIDTH);
    for (const index of [0, 2]) {
      const row = board.cells.filter((cell) => cell.row === index);
      const middle = (row[0].x + row[row.length - 1].x) / 2;
      expect(middle).toBeCloseTo(VIEW_WIDTH / 2, 5);
    }
  });

  it("제목과 안내 문구가 판 밖에 서고 하단 탭을 침범하지 않는다", () => {
    const board = researchBoardLayout(10, VIEW_WIDTH);
    expect(board.titleY).toBeLessThan(board.top);
    expect(board.hintY).toBeGreaterThan(board.bottom);
    expect(board.hintY).toBeLessThan(NAV_TOP);
    expect(board.titleY).toBeGreaterThan(0);
  });

  it("한 장은 가운데에 크게 한 칸만 선다", () => {
    const board = researchBoardLayout(1, VIEW_WIDTH);
    expect(board.cells).toHaveLength(1);
    expect(board.cells[0].x).toBe(VIEW_WIDTH / 2);
    expect(board.tileWidth).toBe(RESEARCH_BOARD.singleWidth);
    expect(board.tileWidth).toBeGreaterThan(researchBoardLayout(10, VIEW_WIDTH).tileWidth);
  });

  it("액자는 칸보다 작아 새로 만난 렐릭 카드가 판에서 먼저 읽힌다", () => {
    const board = researchBoardLayout(10, VIEW_WIDTH);
    expect(board.frameSize).toBeLessThan(board.tileWidth);
    expect(board.frameSize).toBeLessThan(board.tileHeight);
  });
});

describe("연구 결과판이 칸마다 보여 주는 것", () => {
  const rarityOf = (relicId: string): RelicRarity => (relicId === "rex" ? "SSR" : "R");
  const slot = (relicId: string, kind: "new" | "fragment" | "overflow"): PullResultDto => ({
    type: "relic", relicId, kind,
    fragments: kind === "fragment" ? 1 : 0,
    overflowFragments: kind === "overflow" ? 1 : 0,
  });

  it("신규만 카드이고 중복·재화는 액자 한 장으로 접힌다", () => {
    const views = researchSlotViews([
      slot("rex", "new"),
      slot("rex", "fragment"),
      slot("anky", "overflow"),
      { type: "currency", currency: "gold", amount: 120, grade: "GRAY" },
    ], rarityOf);
    expect(views.map((view) => view.kind)).toEqual(["relic", "fragment", "dna", "currency"]);
    // 뒤집힌 칸의 색은 안에 든 것의 등급이다 — 중복이어도 그 개체의 등급을 그대로 말한다.
    expect(views[0].grade).toBe("SSR");
    expect(views[1].grade).toBe("SSR");
    expect(views[2].grade).toBe("GRAY");
    expect(views[3].grade).toBe("GRAY");
  });

  it("액자에 적히는 수는 그 칸이 실제로 늘린 양이다", () => {
    const [fragment, dna, currency] = researchSlotViews([
      slot("rex", "fragment"),
      slot("anky", "overflow"),
      { type: "currency", currency: "cheesecake", amount: 40, grade: "GRAY" },
    ], rarityOf);
    expect(fragment).toMatchObject({ kind: "fragment", amount: 1, relicId: "rex" });
    expect(dna).toMatchObject({ kind: "dna", amount: 1 });
    expect(currency).toMatchObject({ kind: "currency", amount: 40, currency: "cheesecake" });
  });
});

describe("화석을 깨는 그림", () => {
  it("가지는 반드시 몸통 위의 한 점에서 갈라진다", () => {
    const [trunk, ...branches] = CRACK_BRANCHES;
    for (const branch of branches) {
      expect(trunk.some(([x, y]) => x === branch[0][0] && y === branch[0][1])).toBe(true);
      expect(branch.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("균열은 화석 그림 안에 머문다", () => {
    for (const branch of CRACK_BRANCHES) {
      for (const value of crackBranchPoints(branch, FOSSIL_CRACK.size)) {
        expect(Math.abs(value)).toBeLessThanOrEqual(FOSSIL_CRACK.size / 2);
      }
    }
  });

  it("껍질 조각은 위로 튀고 매번 같은 그림으로 흩어진다", () => {
    const shards = fossilShards();
    expect(shards).toHaveLength(FOSSIL_CRACK.shards);
    // 발밑으로 쏟아지면 "터졌다"가 아니라 "흘렸다"로 보인다.
    for (const shard of shards) {
      expect(Math.sin(shard.angle)).toBeLessThan(0);
      expect(shard.distance).toBeGreaterThan(0);
      expect(shard.distance).toBeLessThanOrEqual(FOSSIL_CRACK.shardSpread);
      expect(shard.size).toBeGreaterThan(0);
    }
    // 난수를 쓰지 않는다 — 회귀 테스트가 같은 그림을 읽어야 한다.
    expect(fossilShards()).toEqual(shards);
  });

  it("조각은 동그라미가 아니라 어긋나게 깎은 마름모다", () => {
    const points = shardPoints(100);
    expect(points).toHaveLength(8);
    const ys = points.filter((_, index) => index % 2 === 1);
    // 좌우 꼭짓점의 높이가 같으면 반듯한 보석이 된다.
    expect(ys[1]).not.toBe(ys[3]);
  });
});
