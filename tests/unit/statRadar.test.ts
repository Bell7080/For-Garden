import { describe, expect, it } from "vitest";
import { STAT_RADAR_MAX } from "../../src/config/statRadar";
import { RELICS } from "../../src/data/relics";

describe("레이더 그래프 공용 상한", () => {
  it("모든 운영 캐릭터의 다섯 축을 같은 명시적 범위 안에 둔다", () => {
    // 데이터가 상한을 넘으면 그래프가 포화되어 비교가 왜곡되므로 밸런스 변경 때 즉시 알린다.
    for (const relic of RELICS) {
      for (const key of ["hp", "def", "res", "atk", "ap"] as const) {
        expect(relic.stats[key], `${relic.id}.${key}`).toBeLessThanOrEqual(STAT_RADAR_MAX[key]);
      }
    }
  });
});
