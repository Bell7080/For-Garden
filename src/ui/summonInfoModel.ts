import type { InfoCapabilities } from "../core/infoCapabilities";
import type { Stats, SummonDef } from "../core/types";
import { deriveSummonStats } from "../core/summonStats";

/** 색에 기대지 않고 늑대를 판별하는, 이름과 함께 표시되는 영구 문양이다. */
export type SummonMark = "fang" | "moon";

/** 소환수 정보창이 그리기 코드와 테스트에 함께 제공하는 불변 표시 모델이다. */
export interface SummonInfoModel {
  summon: Readonly<SummonDef>;
  mark: SummonMark;
  ownerBasisLabel: "공격력" | "주문력";
  ownerBasisValue: number;
  stats: Stats;
}

/** 데이터의 성장 축으로 이름 분기 없이 문양·기준 수치·파생치를 한 번에 만든다. */
export function summonInfoModel(summon: Readonly<SummonDef>, ownerStats: Readonly<Stats>): SummonInfoModel {
  const physical = summon.growthStat === "atk";
  return {
    summon,
    mark: physical ? "fang" : "moon",
    ownerBasisLabel: physical ? "공격력" : "주문력",
    ownerBasisValue: ownerStats[summon.growthStat],
    stats: deriveSummonStats(ownerStats, summon),
  };
}

/** 미보유 도감은 기존 성장/스킬 비공개와 함께 귀속 소환수도 감춘다. */
export function canShowSummonInfo(capabilities: Readonly<InfoCapabilities>, owned: boolean): boolean {
  return owned && capabilities.showGrowth;
}

/** 1080×1920에서 본창과 두 중첩 쪽지가 안전 영역 안에 머무는 순수 배치 계약이다. */
export const SUMMON_INFO_LAYOUT = {
  width: 940, height: 940, x: 540, y: 950,
  skillX: -360, skillYs: [-230, 0, 230], skillSize: 142,
  standX: 0, standY: 238, puppetHeight: 390,
  radarX: 272, radarY: -40, radarRadius: 128,
  detail: { width: 650, height: 650 },
} as const;
