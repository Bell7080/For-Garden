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

  it("전장 전체 해일 단계가 생존한 모든 아군을 판정해 결국 최종 전멸 순간에만 종료한다", () => {
    const party = [
      { id: "tank", attack: 10, maxHp: 1_000_000 },
      { id: "dealer", attack: 30, maxHp: 900_000 },
      { id: "support", attack: 20, maxHp: 800_000 },
    ];
    const result = resolveExpeditionBossBattle(party, basicActions(party.map(({ id }) => id), 91));
    expect(expeditionBossPhaseAt(90_000).label).toBe("종말"); expect(result.allAlliesDead).toBe(true); expect(result.endedAtMs).toBe(90_000);
    // 마지막 해일은 한 명만 고르는 대신 그 시점의 생존 파티 전원을 0으로 만든다.
    expect(Object.values(result.remainingHpByAlly)).toEqual([0, 0, 0]);
  });

  it("런에서 이어진 현재 HP를 서버 전멸 시각에 적용한다", () => {
    const full = resolveExpeditionBossBattle([{ id: "ally", attack: 10, maxHp: 1_000 }], basicActions(["ally"]));
    const wounded = resolveExpeditionBossBattle([{ id: "ally", attack: 10, maxHp: 1_000, initialHp: 100 }], basicActions(["ally"]));
    expect(wounded.endedAtMs).toBeLessThan(full.endedAtMs);
    expect(wounded.totalDamage).toBeLessThan(full.totalDamage);
  });

  it("주간 초기화 키는 월요일 00:00 UTC를 경계로 바뀐다", () => {
    expect(expeditionWeekKey(new Date("2026-08-30T23:59:59Z"))).toBe("2026-08-24");
    expect(expeditionWeekKey(new Date("2026-08-31T00:00:00Z"))).toBe("2026-08-31");
  });
});
