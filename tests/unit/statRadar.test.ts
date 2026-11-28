import { describe, expect, it } from "vitest";
import { STAT_RADAR_MAX, statRadarRatios } from "../../src/config/statRadar";
import { RELICS, getRelic } from "../../src/data/relics";
import type { Stats } from "../../src/core/types";

const grow = (stats: Stats, factor: number): Stats => ({ ...stats, hp: stats.hp * factor, def: stats.def * factor, res: stats.res * factor, atk: stats.atk * factor, ap: stats.ap * factor });

describe("레이더 그래프 공용 상한", () => {
  it("공격·방어 네 축은 모든 운영 캐릭터를 같은 명시적 범위 안에 둔다", () => {
    // 데이터가 상한을 넘으면 그래프가 포화되어 비교가 왜곡되므로 밸런스 변경 때 즉시 알린다.
    // 체력 축만 아군 탱커 윗줄에 맞춰 두어, 그 위의 체력(노도니아·보스)은 그 축만 가득 찬다.
    for (const relic of RELICS) {
      for (const key of ["def", "res", "atk", "ap"] as const) {
        expect(relic.stats[key], `${relic.id}.${key}`).toBeLessThanOrEqual(STAT_RADAR_MAX[key]);
      }
    }
  });

  it("렉시아의 면은 주문력이 아니라 체력·공격력 쪽으로 선다", () => {
    const rexia = getRelic("rexia").stats;
    const shape = statRadarRatios(rexia, rexia);
    expect(shape.atk).toBeGreaterThan(shape.hp);
    expect(shape.hp).toBeGreaterThan(shape.ap);
  });

  it("키워도 면의 생김새는 태생 그대로다 — 공격력·주문력이 함께 상한에 붙지 않는다", () => {
    const rexia = getRelic("rexia").stats;
    const born = statRadarRatios(rexia, rexia);
    const grown = statRadarRatios(grow(rexia, 2.6), rexia);
    for (const key of ["hp", "def", "res", "atk", "ap"] as const) expect(grown[key]).toBeCloseTo(born[key], 5);
    expect(grown.ap).toBeLessThan(grown.atk);
  });

  it("유대가 올린 몫은 기준(유대를 뺀 값)으로 잰 배율 밖으로 넘친다", () => {
    const rexia = getRelic("rexia").stats;
    const without = grow(rexia, 2);
    const withBond = grow(rexia, 2.2);
    const from = statRadarRatios(without, rexia);
    const now = statRadarRatios(withBond, rexia, without);
    expect(now.atk).toBeGreaterThan(from.atk);
  });
});
