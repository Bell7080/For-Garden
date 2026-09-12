import type { Fighter } from "../core/skirmish";
import { t } from "../i18n";

/**
 * 머리 위 상태 칩과 그 팝업이 함께 읽는 한 표.
 *
 * 화면 두 곳이 각자 `Fighter`를 뒤지면 칩에는 뜨는데 팝업에는 없는 상태가 생긴다. 색과 이름,
 * 겹 수와 남은 시간을 여기서 한 번만 만들고 둘 다 이 목록만 그린다. Phaser를 들여오지 않아
 * 순서·색·문구를 테스트가 그대로 고정할 수 있다.
 */
export type UnitStatusId = "packKuro" | "packShiro" | "shell" | "stun" | "frozen" | "frenzy" | "taunt" | "bleed" | "poison" | "reagent" | "curse" | "chill" | "submerged" | "overpaint" | "butcher" | "vandalism" | "weakpoint";

export interface UnitStatusView {
  /** 같은 상태를 제공자가 여럿 걸 수 있을 때도 HUD 객체를 덮어쓰지 않는 전투 내 키다. */
  key?: string;
  id: UnitStatusId;
  /** 팝업에 그대로 서는 이름. 규칙어 태그와 같은 표기를 쓴다. */
  name: string;
  /** 칩 색. 피해 수치의 상태 색(`DEBUFF_TONE`)과 같은 계열이라 숫자와 칩이 한 상태로 읽힌다. */
  color: number;
  /** 겹치는 상태만 갖는 겹 수. 칩 우하단의 작은 수가 이 값이다. */
  stacks?: number;
  /** 숫자 대신 채워진 시험관 수로 읽는 자원만 갖는 고정 슬롯 수다. */
  stackSlots?: number;
  /** 남은 시간(초)과 한 바퀴의 전체 시간. 시계 고리가 이 둘의 비로 돈다. */
  remaining?: number;
  total?: number;
  /** 팝업 오른쪽에 서는 한 줄. "무엇이 얼마나"만 말한다. */
  detail: string;
}

/** 상태별 색. 피해 수치의 디버프 색과 같은 계열을 쓴다. */
export const UNIT_STATUS_COLOR: Readonly<Record<UnitStatusId, number>> = {
  /*
   * 무리 칩 둘. 검은 늑대는 이글거리는 재, 흰 늑대는 서리 푸른빛이다.
   *
   * 어두운 배경 원화 위에서 검정은 보이지 않으므로 털색을 그대로 쓰지 않고, 그 몸이 내는
   * 피해의 결(물리·마법)로 가른다. 다른 칩과 같은 액자·같은 크기라 위계가 흔들리지 않는다.
   */
  packKuro: 0xd9603a,
  packShiro: 0x4fa8e4,
  // 보호막 시각 효과와 같은 청록 계열을 사용해 조가비 소비 결과가 한 자원으로 읽히게 한다.
  shell: 0x62c6d8,
  stun: 0xf2c744,
  frozen: 0x6fd0f2,
  frenzy: 0xa8406b,
  taunt: 0xd8913a,
  bleed: 0xc2303a,
  poison: 0x7a4bab,
  // 기존 중독 강조색을 그대로 써 반응 뒤 이어지는 상태와 같은 계열로 읽히게 한다.
  reagent: 0x7a4bab,
  curse: 0x8f6aa4,
  chill: 0x4fa8e4,
  // 여울에 잠긴 상태. 둔화와 같은 계열의 물빛이지만 한 단계 짙어, 바닥에 깔린 판과 머리 위
  // 칩이 같은 물이라는 것이 읽힌다.
  submerged: 0x2f86c4,
  overpaint: 0x62c6d8,
  // 관측 신호의 노란빛. 다른 디버프처럼 눌러 두지 않는 이유는 이것이 지속 피해가 아니라
  // **다음 한 방을 알리는 표식**이라, 듀오가 어디를 밟아야 하는지가 먼저 읽혀야 하기 때문이다.
  weakpoint: 0xe8c33a,
  butcher: 0xc07fa4,
  vandalism: 0xd45aa8,
};

function seconds(value: number): string {
  return t("status.seconds", { value: value >= 10 ? Math.round(value) : Math.round(value * 10) / 10 });
}

/**
 * 지금 이 전투원에게 걸린 상태를 **행동을 막는 것부터** 늘어놓는다.
 *
 * 기절 → 광란 → 출혈 → 덧칠 → 저주 → 손질 순서다. 광란이 기절 다음인 이유는 그 둘만 **무엇을
 * 때리는지 자체를 바꾸기** 때문이다. 순서를 화면이 정하면 같은 상태가 개체마다 다른 자리에
 * 서서, 어디를 봐야 하는지 매번 다시 찾게 된다.
 */
export function unitStatusViews(fighter: Fighter, pack: readonly Fighter[] = []): UnitStatusView[] {
  const views: UnitStatusView[] = [];
  /*
   * 무리는 상태이상이 아니라 **지금 몇 마리가 서 있는가**다. 그래서 맨 앞에 선다 — 지휘자의
   * 은신과 치명타가 이 둘의 생존에 통째로 걸려 있어 다른 무엇보다 먼저 읽혀야 한다.
   *
   * 살아 있으면 시계를 그리지 않는다. 쓰러진 몸만 남은 대기 시간만큼 덮여, 언제 다시 서는지가
   * 다른 시간 상태와 같은 문법으로 읽힌다.
   */
  for (const wolf of pack) {
    const alive = wolf.hp > 0;
    const total = wolf.resummonRule?.cooldownSeconds ?? 0;
    const remaining = Number.isFinite(wolf.resummonIn) ? wolf.resummonIn : 0;
    views.push({
      key: `pack:${wolf.def.id}`,
      id: wolf.def.stats.ap > wolf.def.stats.atk ? "packShiro" : "packKuro",
      name: wolf.def.name,
      color: UNIT_STATUS_COLOR[wolf.def.stats.ap > wolf.def.stats.atk ? "packShiro" : "packKuro"],
      // 서 있는 동안에는 시계를 돌리지 않는다. 덮인 만큼이 곧 남은 대기라는 규칙이 흐려진다.
      remaining: alive ? undefined : remaining,
      total: alive ? undefined : Math.max(total, remaining),
      detail: alive ? t("status.pack.standing") : remaining > 0 ? t("status.pack.returns", { time: seconds(remaining) }) : t("status.pack.gone"),
    });
  }
  if (fighter.shellGuard) {
    const shell = fighter.shellGuard;
    const maxStacks = fighter.def.passive.shellGuard?.maxStacks ?? shell.stacks;
    views.push({
      id: "shell", name: t("status.shell"), color: UNIT_STATUS_COLOR.shell, stacks: shell.stacks,
      remaining: shell.remaining, total: Math.max(shell.total, shell.remaining),
      detail: t("status.shell.detail", { stacks: shell.stacks, max: maxStacks, time: seconds(shell.remaining) }),
    });
  }
  if (fighter.stunnedFor > 0) {
    views.push({
      id: "stun", name: t("status.stun"), color: UNIT_STATUS_COLOR.stun,
      remaining: fighter.stunnedFor, total: Math.max(fighter.stunnedTotal, fighter.stunnedFor),
      detail: t("status.stun.detail", { time: seconds(fighter.stunnedFor) }),
    });
  }
  if (fighter.frozen) {
    const frozen = fighter.frozen;
    views.push({
      id: "frozen", name: t("status.frozen"), color: UNIT_STATUS_COLOR.frozen,
      remaining: frozen.remaining, total: Math.max(frozen.total, frozen.remaining),
      detail: t("status.frozen.detail", { time: seconds(frozen.remaining), percent: frozen.maxHpPercentOnExpire }),
    });
  }
  if (fighter.frenzy) {
    const frenzy = fighter.frenzy;
    views.push({
      id: "frenzy", name: t("status.frenzy"), color: UNIT_STATUS_COLOR.frenzy,
      remaining: frenzy.remaining, total: Math.max(frenzy.total, frenzy.remaining),
      detail: t("status.frenzy.detail", { percent: frenzy.attackSpeedPercent, time: seconds(frenzy.remaining) }),
    });
  }
  if (fighter.taunted) {
    const taunted = fighter.taunted;
    views.push({
      id: "taunt", name: t("status.taunt"), color: UNIT_STATUS_COLOR.taunt,
      remaining: taunted.remaining, total: Math.max(taunted.total, taunted.remaining),
      // 행동을 막지 않고 방향만 바꾸는 상태라, 남은 시간과 "누구만 본다"는 사실만 말한다.
      detail: t("status.taunt.detail", { time: seconds(taunted.remaining) }),
    });
  }
  if (fighter.bleed) {
    views.push({
      id: "bleed", name: t("status.bleed"), color: UNIT_STATUS_COLOR.bleed,
      remaining: fighter.bleed.remaining, total: Math.max(fighter.bleed.total, fighter.bleed.remaining),
      detail: t("status.bleed.detail", { percent: fighter.bleed.percent, time: seconds(fighter.bleed.remaining) }),
    });
  }
  if (fighter.poison) {
    const poison = fighter.poison;
    views.push({
      id: "poison", name: t("status.poison"), color: UNIT_STATUS_COLOR.poison,
      remaining: poison.remaining, total: Math.max(poison.total, poison.remaining),
      // 중독은 맞은 쪽의 비율이 아니라 바른 쪽이 굳혀 둔 값이라, 비율이 아니라 그 수를 그대로 적는다.
      detail: t("status.poison.detail", { amount: poison.amountPerSecond, time: seconds(poison.remaining) }),
    });
  }
  // 제공자별 장부를 합치지 않는다. 여러 리파가 있어도 각자의 1→2→반응 순환이 따로 보인다.
  for (const [providerId, reagent] of Object.entries(fighter.reagents)) {
    views.push({
      key: `reagent:${providerId}`, id: "reagent", name: t("status.reagent"), color: UNIT_STATUS_COLOR.reagent,
      stacks: reagent.stacks, stackSlots: 3,
      remaining: reagent.remaining, total: Math.max(reagent.total, reagent.remaining),
      detail: t("status.reagent.detail", { stacks: reagent.stacks, time: seconds(reagent.remaining) }),
    });
  }
  if (fighter.weakpoint) {
    views.push({
      id: "weakpoint", name: t("status.weakpoint"), color: UNIT_STATUS_COLOR.weakpoint,
      // 시간이 흘러 사라지지 않고 듀오의 다음 한 방으로만 풀리므로 시계를 그리지 않는다.
      detail: t("status.weakpoint.detail"),
    });
  }
  if (fighter.overpaint) {
    const paint = fighter.overpaint;
    views.push({
      id: "overpaint", name: t("status.overpaint"), color: UNIT_STATUS_COLOR.overpaint,
      stacks: paint.stacks,
      remaining: paint.remaining, total: Math.max(paint.total, paint.remaining),
      detail: t("status.overpaint.detail", { stacks: paint.stacks, percent: paint.stacks * paint.percentPerStack, time: seconds(paint.remaining) }),
    });
  }
  if (fighter.curse) {
    const curse = fighter.curse;
    views.push({
      id: "curse", name: t("status.curse"), color: UNIT_STATUS_COLOR.curse,
      stacks: curse.stacks,
      remaining: curse.remaining, total: Math.max(curse.total, curse.remaining),
      detail: t("status.curse.detail", { stacks: curse.stacks, percent: curse.stacks * curse.percentPerStack, time: seconds(curse.remaining) }),
    });
  }
  if (fighter.chill) {
    const chill = fighter.chill;
    views.push({
      id: "chill", name: t("status.chill"), color: UNIT_STATUS_COLOR.chill,
      stacks: chill.stacks,
      detail: t("status.chill.detail", { stacks: chill.stacks, max: chill.maxStacks, percent: chill.stacks * chill.speedPercentPerStack }),
    });
  }
  // 잠김은 시계가 도는 상태가 아니라 **지금 서 있는 자리**다. 물 밖으로 나가면 그 프레임에
  // 사라지므로 남은 시간을 그리지 않는다 — 손질·밴덜리즘과 같은 자리다.
  if (fighter.submergedIn) {
    views.push({
      id: "submerged", name: t("status.submerged"), color: UNIT_STATUS_COLOR.submerged,
      detail: t("status.submerged.detail", { percent: fighter.submergedIn.moveSlowPercent }),
    });
  }
  if (fighter.vandalism) {
    const paint = fighter.vandalism;
    views.push({
      id: "vandalism", name: t("status.vandalism"), color: UNIT_STATUS_COLOR.vandalism,
      stacks: paint.stacks,
      // 손질과 같이 시간이 흘러 사라지지 않는다 — 시계를 그리지 않는 이유이자 그 자체가 성질이다.
      detail: t("status.vandalism.detail", { stacks: paint.stacks, max: paint.maxStacks, percent: paint.stacks * paint.percentPerStack }),
    });
  }
  if (fighter.butcher && fighter.butcher.stacks > 0) {
    const butcher = fighter.butcher;
    views.push({
      id: "butcher", name: t("status.butcher"), color: UNIT_STATUS_COLOR.butcher,
      stacks: butcher.stacks,
      // 손질은 시간이 흘러 사라지지 않는다 — 시계를 두지 않는 이유이자, 그 자체가 성질이다.
      detail: t("status.butcher.detail", { stacks: butcher.stacks, max: butcher.maxStacks }),
    });
  }
  return views;
}
