import { describe, expect, it } from "vitest";
import { expeditionBossPhaseAt, expeditionWeekKey, resolveExpeditionBossBattle, type ExpeditionBossAction } from "../../src/core/expeditionBoss";
import { getRelic } from "../../src/data/relics";

const ARENA = { left: 130, right: 950, top: 600, bottom: 1360 };
/** 검증기 입력도 클라이언트와 같은 렐릭·폰토스 정의를 직접 참조한다. */
function replayInput(initialHp = 100) {
  return { allies: [getRelic("rex")], boss: getRelic("pontos"), arena: ARENA, initialHpPercentByRelic: { rex: initialHp } };
}

/** 매초 기본 공격하는 결정론적 입력을 만들어 점수 계산 자체가 난수에 기대지 않게 한다. */
function basicActions(ids: readonly string[], seconds = 10): ExpeditionBossAction[] {
  return Array.from({ length: Math.ceil(seconds / 2) }, (_, index) => ids.map((actorId) => ({ elapsedMs: index * 2_000, actorId, kind: "basic" as const }))).flat();
}

describe("expedition boss rules", () => {
  it("경감 전 총 공격량이 같은 단타와 다단히트는 같은 서버 재생 점수를 받는다", () => {
    const base = getRelic("rex");
    // 동일 공격자 스냅샷에서 100% 단타와 50% 2연타만 바꿔 방어·무효화 횟수와 점수를 분리한다.
    const single = { ...base, basic: { ...base.basic, power: 100, combo: undefined } };
    const multi = { ...base, basic: { ...base.basic, power: 50, combo: { chancePercent: 100, hitCount: 2, missingHpHealingPercentPerHit: 0 } } };
    const action = [{ elapsedMs: 0, actorId: base.id, kind: "basic" as const }];
    const singleResult = resolveExpeditionBossBattle({ ...replayInput(), allies: [single] }, action, () => 0.99);
    const rolls = [0, 0.99, 0.99];
    const multiResult = resolveExpeditionBossBattle({ ...replayInput(), allies: [multi] }, action, () => rolls.shift() ?? 0.99);
    expect(multiResult.totalDamage).toBe(singleResult.totalDamage);
    // 두 1 피해 후보가 폰토스 HP를 깎지 않아도 서버 점수는 공격자의 기여도를 보존한다.
    expect(multiResult.totalDamage).toBeGreaterThan(0);
  });

  it("보스는 피해를 받아도 죽지 않고 받은 총 피해만 점수로 누적한다", () => {
    const result = resolveExpeditionBossBattle(replayInput(), basicActions(["rex"]));
    expect(result.bossDefeated).toBe(false); expect(result.totalDamage).toBeGreaterThan(0);
  });

  it("폰토스 스킬로 먼저 전멸할 수 있고 제한 시각에는 별도 종말 처형 단계만 남는다", () => {
    const result = resolveExpeditionBossBattle(replayInput(), basicActions(["rex"]));
    expect(expeditionBossPhaseAt(90_000).label).toBe("종말"); expect(result.allAlliesDead).toBe(true); expect(result.endedAtMs).toBeLessThanOrEqual(90_000);
    // 폰토스의 실제 범위 스킬과 종말 처형 모두 단일 대상을 임의 선택하지 않는다.
    expect(Object.values(result.remainingHpByAlly)).toEqual([0]);
  });

  it("런에서 이어진 현재 HP를 서버 전멸 시각에 적용한다", () => {
    const full = resolveExpeditionBossBattle(replayInput(), []);
    const wounded = resolveExpeditionBossBattle(replayInput(10), []);
    expect(wounded.endedAtMs).toBeLessThan(full.endedAtMs);
    expect(wounded.totalDamage).toBeLessThanOrEqual(full.totalDamage);
  });

  it("같은 편성·행동·난수열은 클라이언트 재생과 서버 검증에서 점수와 종료 시각이 일치한다", () => {
    const actions = basicActions(["rex"]); const sequence = [0.8, 0.2, 0.7, 0.9];
    const rng = () => sequence.shift() ?? 0.99;
    const client = resolveExpeditionBossBattle(replayInput(), actions, rng);
    const serverSequence = [0.8, 0.2, 0.7, 0.9];
    const server = resolveExpeditionBossBattle(replayInput(), actions, () => serverSequence.shift() ?? 0.99);
    expect(server).toMatchObject({ totalDamage: client.totalDamage, endedAtMs: client.endedAtMs });
  });

  it("주간 초기화 키는 월요일 00:00 UTC를 경계로 바뀐다", () => {
    expect(expeditionWeekKey(new Date("2026-08-30T23:59:59Z"))).toBe("2026-08-24");
    expect(expeditionWeekKey(new Date("2026-08-31T00:00:00Z"))).toBe("2026-08-31");
  });
});
