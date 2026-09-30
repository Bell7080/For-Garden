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
 * **한 소환수는 주인의 한 축만 따른다**(`growthStat`) — 쿠로는 공격력으로 공격력·체력·방어·저항이,
 * 시로는 주문력으로 주문력·체력·방어·저항이 오른다. 주인이 어느 축을 키웠는지가 곧 어느 늑대가
 * 두꺼워지는지다. **공격 속도·이동 속도는 오르지 않는다** — 그 둘은 정체성이라(규칙 6) 늑대 정의의
 * 태생값을 그대로 쓴다. 입력 객체는 전투 양 진영이 같은 정적 정의를 공유할 수 있도록 절대 변경하지 않는다.
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
    attackSpeed: summon.def.stats.attackSpeed,
    moveSpeed: summon.def.stats.moveSpeed,
    ...SUMMON_SECONDARY_STATS,
    // 늑대는 주인이 게이지를 빌려줘야 궁극기를 쓰지만(0), 스스로 채우는 소환수(디모)는 제 정의의 충전량을 쓴다.
    energyGain: summon.selfCharge === true ? summon.def.stats.energyGain : SUMMON_SECONDARY_STATS.energyGain,
  };
}

/** 양 진영과 편성 칸을 포함해 같은 디안·같은 쌍둥이가 동시에 나와도 충돌하지 않는 런타임 ID다. */
export function summonInstanceId(side: Side, ownerFormationIndex: number, summonId: string): string {
  if (!Number.isInteger(ownerFormationIndex) || ownerFormationIndex < 0) throw new RangeError("소유자 편성 인덱스가 올바르지 않습니다.");
  return `${side}:${ownerFormationIndex}:summon:${summonId}`;
}
