import { describe, expect, it } from "vitest";
import { duelLeaderboard, duelPair, simulateDuel } from "../../src/core/duelBalance";
import { getRelic, PLAYABLE_RELICS } from "../../src/data/relics";

/** 치명타 순서를 달리하는 재현 가능한 표본 셋. 단일 운 좋은 판을 세기로 오인하지 않는다. */
const SEEDS = [1, 2, 3] as const;

const SSR = PLAYABLE_RELICS.filter((relic) => relic.rarity === "SSR");

describe("개체 대 개체 검수", () => {
  it("은 같은 seed와 같은 자리에서 늘 같은 판을 낸다", () => {
    const first = simulateDuel(getRelic("dian"), getRelic("rex"), 7);
    const second = simulateDuel(getRelic("dian"), getRelic("rex"), 7);
    expect(second).toEqual(first);
  });

  it("은 자리 차이를 상쇄하도록 양쪽에서 한 번씩 붙인다", () => {
    const runs = duelPair(getRelic("dian"), getRelic("rex"), [1]);
    expect(runs).toHaveLength(2);
    // 두 판 모두 **왼쪽 기준**으로 기록되므로 표를 읽는 쪽이 자리를 되짚지 않아도 된다.
    for (const run of runs) expect(["left", "right", null]).toContain(run.winner);
  });

  it("은 SSR 라운드로빈에서 디안이 세기와 안전을 동시에 독점하지 않는다", () => {
    const table = duelLeaderboard(SSR, SEEDS);
    // 검수 결과를 눈으로 보려고 남긴다. 승률·이긴 판의 평균 소요·평균 잔여 체력 순이다.
    for (const row of table) {
      console.log(`${row.name}\t승률 ${(row.winRate * 100).toFixed(0)}%\t${row.wins}승 ${row.losses}패 ${row.draws}무\t`
        + `평균 ${row.averageWinSeconds.toFixed(1)}초\t잔여 ${(row.averageHpRatio * 100).toFixed(0)}%`);
    }
    expect(table).toHaveLength(SSR.length);
    // 전승하는 개체가 있으면 그 등급 안에서 고를 이유가 하나로 줄어든다.
    expect(table[0].winRate).toBeLessThan(1);
    /*
     * **디안이 두 축을 동시에 1위 하지 않는다.**
     *
     * 늑대가 앞에 서는 동안 지휘자는 거의 맞지 않으므로 잔여 체력은 늘 높게 나온다. 그것은
     * 이 개체의 정체성이라 그대로 두되, 그렇다면 세기 쪽은 양보해야 한다 — 둘 다 1위면
     * 편성 한 칸이 몸 셋을 갖는 값을 아무것도 치르지 않은 것이다. 탱커가 1대1에서 승률 0에
     * 가까운 것은 사고가 아니라 직업이라 여기서 검사하지 않는다.
     */
    const byWinRate = [...table].sort((first, second) => second.winRate - first.winRate);
    const byHpLeft = [...table].sort((first, second) => second.averageHpRatio - first.averageHpRatio);
    expect([byWinRate[0].relicId, byHpLeft[0].relicId]).not.toEqual(["dian", "dian"]);
  });

  it("은 디안이 로스터 전체를 상대로 SSR이 설 만한 자리에 선다", () => {
    const table = duelLeaderboard(PLAYABLE_RELICS, SEEDS);
    for (const row of table) {
      console.log(`${row.rarity}\t${row.name}\t승률 ${(row.winRate * 100).toFixed(0)}%\t`
        + `평균 ${row.averageWinSeconds.toFixed(1)}초\t잔여 ${(row.averageHpRatio * 100).toFixed(0)}%`);
    }
    const dian = table.find((row) => row.relicId === "dian")!;
    const rank = table.findIndex((row) => row.relicId === "dian") + 1;
    console.log(`디안 순위 ${rank}/${table.length}`);
    /*
     * 띠를 넓게 두는 이유는 이 값이 **밸런스 목표가 아니라 관측치**이기 때문이다.
     *
     * 좁게 못 박으면 다른 개체의 수치를 만질 때마다 이 테스트가 관계없이 깨진다. 여기서
     * 잡으려는 것은 "SSR 하나가 R을 상대로 지거나, 판 전체를 독점하는" 사고 두 가지뿐이다.
     */
    expect(dian.winRate).toBeGreaterThan(0.35);
    expect(dian.winRate).toBeLessThan(0.95);
  });
});
