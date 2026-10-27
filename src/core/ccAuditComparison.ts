import type { CcAuditReport } from "./ccDensityAudit";

type AuditCase = Pick<CcAuditReport, "id" | "metadata" | "units" | "verdict">;

/** 이동 자체의 비용을 CC 탓으로 단정하지 않도록 같은 seed·배치의 무증강 결과와 비교한다. */
export function compareCcAuditPairs(cases: readonly AuditCase[]) {
  const groups = new Map<string, { baseline?: AuditCase; augmented?: AuditCase }>();
  for (const result of cases) {
    const key = result.metadata.pairedScenario;
    if (typeof key !== "string") continue;
    const group = groups.get(key) ?? {};
    if (result.id.endsWith(":baseline")) group.baseline = result;
    if (result.id.endsWith(":augmented")) group.augmented = result;
    groups.set(key, group);
  }
  return [...groups].flatMap(([id, { baseline, augmented }]) => {
    if (!baseline || !augmented) return [];
    return [{ id, baselineVerdict: baseline.verdict, augmentedVerdict: augmented.verdict,
      introducedRisk: baseline.verdict === "pass" && augmented.verdict === "fail",
      units: augmented.units.flatMap(unit => {
        const original = baseline.units.find(other => other.fighterId === unit.fighterId);
        if (!original) return [];
        return [{ fighterId: unit.fighterId, baselineHostileAttacks: original.hostileAttackFrames,
          augmentedHostileAttacks: unit.hostileAttackFrames,
          hostileAttacksLost: original.hostileAttackFrames - unit.hostileAttackFrames,
          firstAttackDelaySeconds: unit.firstHostileAttackSeconds === null || original.firstHostileAttackSeconds === null
            ? null : +(unit.firstHostileAttackSeconds - original.firstHostileAttackSeconds).toFixed(6),
          controlledSecondsDelta: +(unit.controlledSeconds - original.controlledSeconds).toFixed(6),
          longestContinuousSecondsDelta: +(unit.longestContinuousSeconds - original.longestContinuousSeconds).toFixed(6),
          maxAttackGapSecondsDelta: +(unit.maxHostileAttackGapSeconds - original.maxHostileAttackGapSeconds).toFixed(6),
          forcedPursuitSecondsDelta: +(unit.forcedPursuitSeconds - original.forcedPursuitSeconds).toFixed(6) }];
      }) }];
  });
}
