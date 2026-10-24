import { compareCcAuditPairs } from "../../src/core/ccAuditComparison";
import { describe, it, expect } from "vitest";
import { auditCcDensity, currentCcKinds } from "../../src/core/ccDensityAudit";
import { createCcStressScenario, createCcCombatScenario, createCcMatrixScenarios, createCcEngagementScenarios } from "../../src/core/ccAuditScenarios";
import { capExpeditionControl, expeditionControlCooldown } from "../../src/core/expeditionCcPolicy";
import { getExpeditionAugment } from "../../src/data/expeditionAugments";
import { expeditionAugmentEffectLabel } from "../../src/ui/expeditionAugmentBadges";
import { expeditionAugmentKeywords } from "../../src/ui/expeditionAugmentKeywords";

describe("CC 과밀도 공용 진단", () => {
  it("동시에 걸린 제어는 합집합으로 세며 실제 자유 구간과 표본 부족을 판정한다", () => {
    const scenario = createCcStressScenario({ ids: [], durationSeconds: 1 });
    scenario.limits = { maxContinuousSeconds: 0.3, maxControlledRatio: 0.5, minFreeGapSeconds: 0.08, minimumObservationSeconds: 1 };
    scenario.beforeStep = state => {
      const target = state.fighters.find(f => f.side === "enemy")!;
      const t = state.elapsed + 1e-8;
      target.stunnedFor = t < 0.2 || t >= 0.3 && t < 0.5 ? 0.04 : 0;
      target.staggeredFor = t < 0.2 ? 0.04 : 0;
    };
    const report = auditCcDensity(scenario), unit = report.units[0];
    expect(unit.controlledSeconds).toBeCloseTo(0.4, 5);
    expect(unit.longestContinuousSeconds).toBeCloseTo(0.2, 5);
    expect(unit.minFreeGapSeconds).toBeCloseTo(0.1, 5);
    expect(unit.byKindSeconds.stagger).toBeCloseTo(0.2, 5);
    expect(report.verdict).toBe("pass");
    expect(auditCcDensity({ ...scenario, limits: { ...scenario.limits, minimumObservationSeconds: 10 } }).verdict).toBe("insufficient");
  });

  it("동일 seed는 실제 행동·CC 타임라인을 동일하게 재현한다", () => {
    const scenario = createCcStressScenario({ ids: ["tag-stagger-basic", "tag-taunt-basic", "tag-frozen-ultimate"], durationSeconds: 4 });
    expect(auditCcDensity(scenario)).toEqual(auditCcDensity(scenario));
  });

  it("도발을 표적 제약 CC로 포함한다", () => {
    const scenario = createCcStressScenario({ ids: [] });
    const state = scenario.createState(), target = state.fighters.at(-1)!;
    target.taunted = { remaining: 0.4, total: 0.4, sourceId: state.fighters[0].id };
    expect(currentCcKinds(target)).toContain("taunt");
  });

  it.each(["stage", "raid", "endless"] as const)("%s 프리셋은 실제 전투를 실행하고 짧은 관측을 통과로 숨기지 않는다", mode => {
    const report = auditCcDensity(createCcCombatScenario({ mode, durationSeconds: 0.5 }));
    expect(report.combatants.length).toBeGreaterThan(3);
    expect(report.verdict).toBe("insufficient");
    expect(report.combatants.every(f => Number.isFinite(f.attackIntervalSeconds) && f.moveSpeed > 0)).toBe(true);
  });

  it("동일 CC의 세 명 분산과 공속·이속·돌파·배치 쌍을 포함한다", () => {
    const matrix = createCcMatrixScenarios({ quick: true });
    expect(matrix.some(s => s.id.includes("tag-taunt-basic+tag-taunt-basic+tag-taunt-basic"))).toBe(true);
    const engagement = createCcEngagementScenarios({ quick: true });
    expect(new Set(engagement.map(s => s.metadata!.breakthrough))).toEqual(new Set([0,4]));
    for (const scenario of engagement.filter(s => String(s.id).endsWith(":baseline"))) {
      expect(engagement.find(s => s.id === scenario.id.replace(":baseline", ":augmented"))?.seed).toBe(scenario.seed);
    }
  });

  it("같은 배치의 무증강 비교로 첫 공격 지연과 공격 손실을 구분한다", () => {
    const report = auditCcDensity(createCcStressScenario({ ids: [], durationSeconds: 1 }));
    const baseline = { ...report, id: "pair:baseline", metadata: { pairedScenario: "pair" }, verdict: "pass" as const };
    const augmented = { ...baseline, id: "pair:augmented", verdict: "fail" as const, units: baseline.units.map(unit => ({ ...unit,
      hostileAttackFrames: unit.hostileAttackFrames - 1, firstHostileAttackSeconds: unit.firstHostileAttackSeconds! + 0.6 })) };
    const pair = compareCcAuditPairs([baseline, augmented])[0];
    expect(pair.introducedRisk).toBe(true);
    expect(pair.units[0]).toMatchObject({ hostileAttacksLost: 1, firstAttackDelaySeconds: 0.6 });
  });

  it("잘못된 관측 길이·샘플 간격을 거부한다", () => {
    const scenario = createCcStressScenario({ ids: [] });
    expect(() => auditCcDensity({ ...scenario, stepSeconds: 0 })).toThrow(RangeError);
    expect(() => auditCcDensity({ ...scenario, durationSeconds: NaN })).toThrow(RangeError);
    expect(() => auditCcDensity({ ...scenario, limits: { ...scenario.limits, maxControlledRatio: NaN } })).toThrow(RangeError);
  });
});

describe("증강 CC 공용 안전장치", () => {
  it("상태 위력이 높아도 제어 0.6초 상한을 지키며 스택 유지시간은 줄이지 않는다", () => {
    expect(capExpeditionControl({ kind: "stun", seconds: 2 }, 2)).toMatchObject({ seconds: 0.3 });
    expect(capExpeditionControl({ kind: "drowsy", seconds: 12, sleepSeconds: 1.8, maxStacks: 3, wakeResistancePower: 1, groggySeconds: 2, groggyAttackSpeedPercent: 8 }, 2)).toMatchObject({ seconds: 12, sleepSeconds: 0.3 });
  });

  it.each([['stagger',1,2], ['stun',4,6], ['chill',4,4], ['fear',6,6], ['frozen',8,8], ['taunt',8,8], ['pressure',10,10], ['drowsy',10,10], ['intimidate',10,10]] as const)("%s의 기본 %i초/궁극기 %i초 대기를 데이터·카드·팝업이 공유한다", (kind, basicSeconds, ultimateSeconds) => {
    for (const variant of ["basic", "ultimate"]) {
      const seconds = variant === "basic" ? basicSeconds : ultimateSeconds;
      const def = getExpeditionAugment(`tag-${kind}-${variant}`)!;
      if (def.effect.kind !== "triggered") throw Error("Missing trigger");
      expect(expeditionControlCooldown(def.effect.payload)).toBe(seconds);
      expect(def.effect.limits.cooldownSeconds).toBe(seconds);
      expect(expeditionAugmentEffectLabel(def)).toContain(`${seconds}초`);
      expect(expeditionAugmentKeywords(def)[0].description).toContain("2.4초");
    }
  });

  it("실측 발동 시계가 개별 재발동 대기를 지키며 높은 상태 위력도 공용 상한을 넘기지 않는다", () => {
    const scenario = createCcStressScenario({ ids: ["tag-stagger-basic", "tag-stun-basic", "tag-taunt-ultimate"] });
    const original = scenario.createState;
    scenario.createState = () => { const state = original(); state.fighters.filter(f => f.side === "player").forEach(f => { f.statusPotencyMultiplier = 10; }); return state; };
    const report = auditCcDensity(scenario);
    expect(report.verdict).toBe("pass");
    expect(report.combatants[0].attackSpeed).toBeCloseTo(568);
    expect(report.triggerActivations!.length).toBeGreaterThan(0);
    for (const trigger of report.triggerActivations!) for (let i = 1; i < trigger.times.length; i++) {
      expect(trigger.times[i] - trigger.times[i-1] + 1e-6).toBeGreaterThanOrEqual(trigger.cooldownSeconds);
    }
  });

  it.each([false,true])("세 명이 여러 제어를 섞어도 공용 회복 창과 실제 적 공격을 보장한다: offset=%s", offset => {
    const ids = ["stagger", "stun", "frozen", "fear", "frenzy", "knockback", "pressure", "drowsy", "intimidate", "taunt"].map((kind,i) => `tag-${kind}-${i%2?'ultimate':'basic'}`);
    const report = auditCcDensity(createCcStressScenario({ ids, offset }));
    expect(report.verdict).toBe("pass");
    expect(report.units[0].longestContinuousSeconds).toBeLessThanOrEqual(0.64);
    expect(report.units[0].minFreeGapSeconds).toBeGreaterThanOrEqual(2.36);
    expect(report.units[0].hostileAttackFrames).toBeGreaterThan(0);
    const unit = report.units[0], intervals = unit.intervals!;
    for (let i = 1; i < intervals.length; i++) {
      const action = unit.hostileAttackTimes!.find(at => at >= intervals[i-1].end - 0.02 && at < intervals[i].start);
      expect(action).toBeDefined();
      expect(intervals[i].start - action!).toBeGreaterThanOrEqual(2.36);
    }
  });
});
