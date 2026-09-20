/**
 * 던전이 공유하는 **단축 규칙**. 한 번의 손으로 여러 판을 끝내는 두 가지가 여기 있다.
 *
 * - **배율**(`multiplier`): 스테미나와 보상에 같은 수를 곱해 한 번에 여러 판을 턴다.
 * - **소탕**(`sweep`): 이미 이긴 단계를 전투 없이 그 결과만 받는다.
 *
 * 던전마다 제 나름의 단축을 짜면 같은 손짓이 치즈케이크 대작전에서는 x3까지, 현상수배에서는
 * x2까지가 되고, 어디는 광고로 열리고 어디는 그냥 열린다. 그래서 규칙은 여기 하나뿐이고
 * 던전은 **자기 한 판의 값**(스테미나·보상)과 **어디까지 깼나**만 넘긴다.
 *
 * Phaser도 세션도 읽지 않는 순수 모듈이라 서버 경계(`FakeServer`)와 화면이 같은 계산을 쓴다 —
 * 갈리면 화면이 약속한 보상과 실제로 들어온 보상이 다르다.
 */

/** 지금 열려 있는 배율. 표에 없는 수는 존재하지 않는다. */
export const DUNGEON_MULTIPLIERS = [1, 2, 3] as const;
export type DungeonMultiplier = (typeof DUNGEON_MULTIPLIERS)[number];

/**
 * x2까지는 누구나 쓴다. **x3부터가 광고 제거 멤버십의 몫이다.**
 *
 * 경계를 수가 아니라 이름으로 두는 이유는, 배율이 늘어날 때(x5 같은) 어디부터가 멤버십인지를
 * 고치는 자리가 한 곳으로 남기 때문이다.
 */
export const FREE_MULTIPLIER_LIMIT: DungeonMultiplier = 2;

/** 그 배율을 지금 쓸 수 있는지. 멤버십이 없으면 무료 구간까지만 열린다. */
export function isMultiplierUnlocked(multiplier: DungeonMultiplier, adFreeMembership: boolean): boolean {
  return multiplier <= FREE_MULTIPLIER_LIMIT || adFreeMembership;
}

/** 어떤 값이든 실제로 존재하는 배율로 좁힌다. 잘못된 외부 입력은 x1로 수렴시킨다. */
export function normalizeMultiplier(value: unknown): DungeonMultiplier {
  return DUNGEON_MULTIPLIERS.find((allowed) => allowed === value) ?? 1;
}

/** 한 판의 값. 던전은 이것만 만들어 넘기고 곱하기는 하지 않는다. */
export interface DungeonRunCost {
  /** 한 판에 드는 스테미나다. */
  staminaCost: number;
  /** 한 판을 이겼을 때 받는 재화다. 키는 지갑의 재화 이름이다. */
  rewards: Readonly<Record<string, number>>;
}

/** 배율까지 곱한 한 번의 출격/소탕 결과다. */
export interface DungeonShortcutSettlement {
  multiplier: DungeonMultiplier;
  staminaCost: number;
  rewards: Record<string, number>;
}

/**
 * 배율을 곱한다. **스테미나와 보상에 같은 수를 곱한다** — 한쪽만 곱하면 배율이 할인이나
 * 벌금이 되어, 어느 배율로 도는지가 효율을 정하는 숨은 선택이 된다.
 */
export function applyDungeonMultiplier(cost: DungeonRunCost, multiplier: DungeonMultiplier): DungeonShortcutSettlement {
  return {
    multiplier,
    staminaCost: cost.staminaCost * multiplier,
    rewards: Object.fromEntries(Object.entries(cost.rewards).map(([currency, amount]) => [currency, amount * multiplier])),
  };
}

/** 소탕을 막는 이유. `null`이면 지금 소탕할 수 있다. */
export type SweepRefusal = "not_cleared" | "multiplier_locked" | "not_enough_stamina";

/** 소탕 가능 여부를 한 곳에서 판정해 화면의 잠금과 서버의 거절이 갈리지 않게 한다. */
export function sweepRefusal(input: {
  cleared: boolean;
  multiplier: DungeonMultiplier;
  adFreeMembership: boolean;
  stamina: number;
  cost: DungeonRunCost;
}): SweepRefusal | null {
  // **이겨 본 단계만 소탕한다.** 전투를 건너뛰는 것이지 이긴 셈 쳐 주는 것이 아니다.
  if (!input.cleared) return "not_cleared";
  if (!isMultiplierUnlocked(input.multiplier, input.adFreeMembership)) return "multiplier_locked";
  if (input.stamina < applyDungeonMultiplier(input.cost, input.multiplier).staminaCost) return "not_enough_stamina";
  return null;
}
