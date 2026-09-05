import type { Fighter } from "../core/skirmish";

/**
 * 머리 위 상태 칩과 그 팝업이 함께 읽는 한 표.
 *
 * 화면 두 곳이 각자 `Fighter`를 뒤지면 칩에는 뜨는데 팝업에는 없는 상태가 생긴다. 색과 이름,
 * 겹 수와 남은 시간을 여기서 한 번만 만들고 둘 다 이 목록만 그린다. Phaser를 들여오지 않아
 * 순서·색·문구를 테스트가 그대로 고정할 수 있다.
 */
export type UnitStatusId = "stun" | "frenzy" | "bleed" | "poison" | "curse" | "overpaint" | "butcher";

export interface UnitStatusView {
  id: UnitStatusId;
  /** 팝업에 그대로 서는 이름. 규칙어 태그와 같은 표기를 쓴다. */
  name: string;
  /** 칩 색. 피해 수치의 상태 색(`DEBUFF_TONE`)과 같은 계열이라 숫자와 칩이 한 상태로 읽힌다. */
  color: number;
  /** 겹치는 상태만 갖는 겹 수. 칩 우하단의 작은 수가 이 값이다. */
  stacks?: number;
  /** 남은 시간(초)과 한 바퀴의 전체 시간. 시계 고리가 이 둘의 비로 돈다. */
  remaining?: number;
  total?: number;
  /** 팝업 오른쪽에 서는 한 줄. "무엇이 얼마나"만 말한다. */
  detail: string;
}

/** 상태별 색. 피해 수치의 디버프 색과 같은 계열을 쓴다. */
export const UNIT_STATUS_COLOR: Readonly<Record<UnitStatusId, number>> = {
  stun: 0xf2c744,
  frenzy: 0xa8406b,
  bleed: 0xc2303a,
  poison: 0x7a4bab,
  curse: 0x8f6aa4,
  overpaint: 0x62c6d8,
  butcher: 0xc07fa4,
};

function seconds(value: number): string {
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10}초`;
}

/**
 * 지금 이 전투원에게 걸린 상태를 **행동을 막는 것부터** 늘어놓는다.
 *
 * 기절 → 광란 → 출혈 → 덧칠 → 저주 → 손질 순서다. 광란이 기절 다음인 이유는 그 둘만 **무엇을
 * 때리는지 자체를 바꾸기** 때문이다. 순서를 화면이 정하면 같은 상태가 개체마다 다른 자리에
 * 서서, 어디를 봐야 하는지 매번 다시 찾게 된다.
 */
export function unitStatusViews(fighter: Fighter): UnitStatusView[] {
  const views: UnitStatusView[] = [];
  if (fighter.stunnedFor > 0) {
    views.push({
      id: "stun", name: "기절", color: UNIT_STATUS_COLOR.stun,
      remaining: fighter.stunnedFor, total: Math.max(fighter.stunnedTotal, fighter.stunnedFor),
      detail: `${seconds(fighter.stunnedFor)} 남음`,
    });
  }
  if (fighter.frenzy) {
    const frenzy = fighter.frenzy;
    views.push({
      id: "frenzy", name: "광란", color: UNIT_STATUS_COLOR.frenzy,
      remaining: frenzy.remaining, total: Math.max(frenzy.total, frenzy.remaining),
      detail: `자기 편을 공격 · 공격 속도 +${frenzy.attackSpeedPercent}% · ${seconds(frenzy.remaining)} 남음`,
    });
  }
  if (fighter.bleed) {
    views.push({
      id: "bleed", name: "출혈", color: UNIT_STATUS_COLOR.bleed,
      remaining: fighter.bleed.remaining, total: Math.max(fighter.bleed.total, fighter.bleed.remaining),
      detail: `매초 최대 체력의 ${fighter.bleed.percent}% · ${seconds(fighter.bleed.remaining)} 남음`,
    });
  }
  if (fighter.poison) {
    const poison = fighter.poison;
    views.push({
      id: "poison", name: "중독", color: UNIT_STATUS_COLOR.poison,
      remaining: poison.remaining, total: Math.max(poison.total, poison.remaining),
      // 중독은 맞은 쪽의 비율이 아니라 바른 쪽이 굳혀 둔 값이라, 비율이 아니라 그 수를 그대로 적는다.
      detail: `매초 ${poison.amountPerSecond} · ${seconds(poison.remaining)} 남음`,
    });
  }
  if (fighter.overpaint) {
    const paint = fighter.overpaint;
    views.push({
      id: "overpaint", name: "덧칠", color: UNIT_STATUS_COLOR.overpaint,
      stacks: paint.stacks,
      remaining: paint.remaining, total: Math.max(paint.total, paint.remaining),
      detail: `${paint.stacks}겹 · 받는 피해 +${paint.stacks * paint.percentPerStack}% · ${seconds(paint.remaining)} 남음`,
    });
  }
  if (fighter.curse) {
    const curse = fighter.curse;
    views.push({
      id: "curse", name: "저주", color: UNIT_STATUS_COLOR.curse,
      stacks: curse.stacks,
      remaining: curse.remaining, total: Math.max(curse.total, curse.remaining),
      detail: `${curse.stacks}겹 · 저항력 -${curse.stacks * curse.percentPerStack}% · ${seconds(curse.remaining)} 남음`,
    });
  }
  if (fighter.butcher && fighter.butcher.stacks > 0) {
    const butcher = fighter.butcher;
    views.push({
      id: "butcher", name: "손질", color: UNIT_STATUS_COLOR.butcher,
      stacks: butcher.stacks,
      // 손질은 시간이 흘러 사라지지 않는다 — 시계를 두지 않는 이유이자, 그 자체가 성질이다.
      detail: `${butcher.stacks} / ${butcher.maxStacks}겹 · 다 차면 그 자리에서 터진다`,
    });
  }
  return views;
}
