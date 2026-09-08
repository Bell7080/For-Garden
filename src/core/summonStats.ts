import type { Side, Stats, SummonDef } from "./types";

/** 소환수에게 없는 렐릭 전용 부가 능력치는 0으로 고정해 Stats 소비 경로를 안전하게 공유한다. */
const SUMMON_SECONDARY_STATS: Pick<Stats, "critChance" | "critDamage" | "energyGain" | "lifeSteal" | "ferocityGain"> = {
  critChance: 0,
  critDamage: 150,
  energyGain: 0,
  lifeSteal: 0,
  ferocityGain: 0,
};

/**
 * 주인의 모든 성장·장비가 반영된 Stats에서 귀속 소환수의 능력치를 파생한다.
 *
 * 각 항목은 먼저 성장 기준에 계수를 곱해 정수로 반올림하고, 그 다음 공속·이속 상한을 적용한다.
 * 이 순서를 고정하면 상한 근처의 소수점이 먼저 잘려 플랫폼에 따라 제한을 넘는 일을 막을 수 있다.
 * 입력 객체는 전투 양 진영이 같은 정적 정의를 공유할 수 있도록 절대 변경하지 않는다.
 */
export function deriveSummonStats(ownerStats: Readonly<Stats>, summon: Readonly<SummonDef>): Stats {
  const basis = ownerStats[summon.growthStat];
  const scaled = (coefficient: number): number => Math.round(basis * coefficient);
  return {
    hp: scaled(summon.scaling.hp),
    atk: summon.growthStat === "atk" ? scaled(summon.scaling.atk) : 0,
    ap: summon.growthStat === "ap" ? scaled(summon.scaling.atk) : 0,
    def: scaled(summon.scaling.def),
    res: scaled(summon.scaling.res),
    // 반올림을 먼저 하고 상한을 적용한다. 상한값 자체는 정수라 결과도 늘 결정적이다.
    attackSpeed: Math.min(scaled(summon.scaling.attackSpeed), summon.scaling.attackSpeedCap),
    moveSpeed: Math.min(scaled(summon.scaling.moveSpeed), summon.scaling.moveSpeedCap),
    ...SUMMON_SECONDARY_STATS,
  };
}

/** 양 진영과 편성 칸을 포함해 같은 디안·같은 쌍둥이가 동시에 나와도 충돌하지 않는 런타임 ID다. */
export function summonInstanceId(side: Side, ownerFormationIndex: number, summonId: string): string {
  if (!Number.isInteger(ownerFormationIndex) || ownerFormationIndex < 0) throw new RangeError("소유자 편성 인덱스가 올바르지 않습니다.");
  return `${side}:${ownerFormationIndex}:summon:${summonId}`;
}
