import { describe, expect, it } from "vitest";
import { expeditionBossPhaseAt, expeditionWeekKey, resolveExpeditionBossBattle, type ExpeditionBossAction } from "../../src/core/expeditionBoss";

/** 매초 기본 공격하는 결정론적 입력을 만들어 점수 계산 자체가 난수에 기대지 않게 한다. */
function basicActions(ids: readonly string[], seconds = 90): ExpeditionBossAction[] {
  return Array.from({ length: seconds }, (_, second) => ids.map((actorId) => ({ elapsedMs: second * 1_000, actorId, kind: "basic" as const }))).flat();
}

describe("expedition boss rules", () => {
  it("보스는 피해를 받아도 죽지 않고 받은 총 피해만 점수로 누적한다", () => {
    const result = resolveExpeditionBossBattle([{ id: "ally", attack: 100, maxHp: 1_000 }], basicActions(["ally"]));
    expect(result.bossDefeated).toBe(false); expect(result.totalDamage).toBeGreaterThan(0);
  });

  it("시간 단계가 강해져 결국 아군 전멸 순간에 종료한다", () => {
    const result = resolveExpeditionBossBattle([{ id: "tank", attack: 10, maxHp: 1_000_000 }], basicActions(["tank"], 91));
    expect(expeditionBossPhaseAt(90_000).label).toBe("종말"); expect(result.allAlliesDead).toBe(true); expect(result.endedAtMs).toBe(90_000); expect(result.remainingHpByAlly.tank).toBe(0);
  });

  it("주간 초기화 키는 월요일 00:00 UTC를 경계로 바뀐다", () => {
    expect(expeditionWeekKey(new Date("2026-08-30T23:59:59Z"))).toBe("2026-08-24");
    expect(expeditionWeekKey(new Date("2026-08-31T00:00:00Z"))).toBe("2026-08-31");
  });
});
