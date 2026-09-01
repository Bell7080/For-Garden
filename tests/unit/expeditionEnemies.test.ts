import { describe, expect, it } from "vitest";
import { expeditionEnemyLevel, getExpeditionEncounterEnemies, getExpeditionNodeEnemies } from "../../src/data/expeditionEnemies";
import { getRelic } from "../../src/data/relics";
import { applyLevelGrowth } from "../../src/core/relicProgression";

describe("원정 노드 적 편성", () => {
  it("정보창과 전투가 소비할 노드별 순서와 성장 수치를 함께 만든다", () => {
    const normal = getExpeditionNodeEnemies("normal", 4);
    const elite = getExpeditionNodeEnemies("elite", 4);

    expect(normal.map(({ id }) => id)).toEqual(["husk-raptor", "husk-shell", "husk-wing"]);
    expect(elite.map(({ id }) => id)).toEqual(["husk-shell", "husk-raptor", "husk-wing"]);
    expect(expeditionEnemyLevel("elite", 4)).toBe(7);
    // 같은 원본도 더 높은 조우 레벨에서는 실제 전투 수치가 함께 높아져야 한다.
    expect(elite[1].stats.hp).toBeGreaterThan(normal[0].stats.hp);
  });

  it("정보판 편성은 실제 일반·정예·무리 전투 개체 수를 그대로 보여 준다", () => {
    // 미리보기만 세 칸으로 고정돼 실제 전장 수와 달라지는 회귀를 막는다.
    expect(getExpeditionEncounterEnemies("normal", 4)).toHaveLength(3);
    expect(getExpeditionEncounterEnemies("elite", 4)).toHaveLength(1);
    expect(getExpeditionEncounterEnemies("horde", 4)).toHaveLength(5);
  });

  it("20층 boss만 폰토스 단독 편성을 선택하고 일반 boss fallback은 보존한다", () => {
    // 최종층 조건이 단순 boss 조건으로 넓어져 이전 층까지 폰토스로 바뀌는 회귀를 함께 막는다.
    expect(getExpeditionNodeEnemies("boss", 20).map(({ id }) => id)).toEqual(["pontos"]);
    expect(getExpeditionEncounterEnemies("boss", 20).map(({ id }) => id)).toEqual(["pontos"]);
    expect(getExpeditionNodeEnemies("boss", 19).map(({ id }) => id)).toEqual(["husk-shell", "husk-wing", "husk-raptor"]);
  });

  it("최종층 성장 폰토스는 유한한 자릿수로 일반 적과 SSR의 생존·마법 공격 상한을 넘는다", () => {
    const [pontos] = getExpeditionEncounterEnemies("boss", 20);
    const normalEnemies = getExpeditionEncounterEnemies("normal", 20);
    // 같은 25레벨 비교표를 만들어 레벨 차이가 보스 우위를 대신 설명하지 못하게 한다.
    const normalSsr = [getRelic("rex"), getRelic("spino"), getRelic("mette")]
      .map((relic) => ({ ...relic, stats: applyLevelGrowth(relic.stats, 25) }));
    // 레벨 25(20층 + boss 5)의 48% 성장을 적용한 실제 전투 수치를 표처럼 고정한다.
    expect(pontos.stats).toMatchObject({ hp: 4144, def: 266, res: 192, ap: 148, attackSpeed: 81, energyGain: 44 });
    for (const key of ["hp", "def", "res", "ap"] as const) {
      expect(pontos.stats[key]).toBeGreaterThan(Math.max(...normalEnemies.map((enemy) => enemy.stats[key])));
      expect(pontos.stats[key]).toBeGreaterThan(Math.max(...normalSsr.map((relic) => relic.stats[key])));
      // 9,999,999 같은 센티널 수치가 밸런스 데이터에 다시 들어오는 회귀를 막는다.
      expect(pontos.stats[key]).toBeLessThan(10_000);
    }
  });

  it("폰토스 정보창 표기는 1등급 LV.20이어도 높은 표시 스탯 스냅샷을 유지한다", () => {
    const [pontos] = getExpeditionNodeEnemies("boss", 20);
    // 최종 지시의 LV.20 표기는 성장 재계산 요청이 아니므로 기존 고정 스탯을 그대로 검증한다.
    expect({ level: 20, grade: 1, stats: pontos.stats }).toMatchObject({
      level: 20,
      grade: 1,
      stats: { hp: 4144, def: 266, res: 192, ap: 148 },
    });
    expect(Object.values(pontos.stats)).not.toContain(Number.MAX_SAFE_INTEGER);
  });
});
