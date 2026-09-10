import type { InfoCapabilities } from "../core/infoCapabilities";
import type { KeywordDef } from "../data/keywords";
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

/**
 * 패시브 본문이 가리키는 소환수 태그의 ID다.
 *
 * 정의 ID에서 만들므로 화면이 쿠로·시로라는 이름으로 분기하지 않는다. 지휘자가 늘어도
 * 데이터의 소환수 ID를 그대로 쓰면 같은 태그가 만들어진다.
 */
export function summonKeywordId(summon: Readonly<SummonDef>): string {
  return `summon-${summon.id}`;
}

/**
 * 전용 창을 열 수 없는 자리(미보유 도감)에서도 태그가 스스로를 설명하도록 만드는 뜻풀이다.
 *
 * 문장을 따로 적어 두지 않고 성장 축·재호출 규칙에서 만들어, 수치를 고친 뒤 옛 문장이 남지
 * 않게 한다.
 */
export function summonKeyword(summon: Readonly<SummonDef>, ownerName: string): KeywordDef {
  const physical = summon.growthStat === "atk";
  return {
    id: summonKeywordId(summon),
    term: summon.name,
    kind: "규칙",
    description: `${ownerName}가 부리는 근거리 소환수다. ${ownerName}의 ${physical ? "공격력" : "주문력"}에서 능력치를 얻고`
      + ` ${physical ? "[[physical-damage|물리 피해]]" : "[[magical-damage|마법 피해]]"}를 준다.`
      + ` 자기 체력을 따로 갖고 있어 전장에서 체력 바가 함께 서며, 쓰러지면 ${summon.resummon.cooldownSeconds}초 뒤`
      + ` 최대 체력의 ${summon.resummon.hpPercent}%로 돌아온다.`,
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
  /**
   * SD는 오각형을 가리지 않을 만큼만 세운다.
   *
   * 390 높이로 가운데에 세웠을 때 늑대 원화의 가로 폭(내용 기준 1079/1005)이 실제로는 높이보다
   * 넓어, 능력치 판 왼쪽 절반을 통째로 덮었다. 높이를 줄이고 스킬 액자와 오각형 사이의 빈 자리로
   * 옮겨 세 영역이 서로 겹치지 않게 한다.
   */
  standX: -96, standY: 258, puppetHeight: 300,
  standWidth: 272, standRingWidth: 248, standRingHeight: 54,
  radarX: 272, radarY: -40, radarRadius: 128,
  detail: { width: 650, height: 650 },
} as const;
