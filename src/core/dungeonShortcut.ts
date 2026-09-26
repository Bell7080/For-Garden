/**
 * 던전이 공유하는 **단축 규칙** — 스테미나 사다리와 소탕.
 *
 * - **스테미나 사다리**(`dungeonRunStamina`): 한 판의 스테미나는 던전이 아니라 **적 레벨**이 정한다.
 *   현상수배와 치즈케이크 대작전이 저마다 값을 적던 때는 같은 `LV.15`가 한쪽에서는 10, 다른
 *   쪽에서는 15였다 — 같은 레벨은 어디서나 같은 세기이듯 같은 값을 치른다.
 * - **소탕**(`sweep`): 이미 이긴 단계를 전투 없이 **원하는 횟수만큼** 턴다. 한때 x1·x2·x3 배율이
 *   함께 있었는데, 소탕이 횟수를 고를 수 있으면 배율은 "한 번에 여러 판"을 두 번 말하는 손잡이였다.
 *   스테미나를 한 번에 녹이는 일은 소탕 하나가 맡는다.
 * - **소탕은 공짜가 아니다**: 멤버십이 없으면 한 번에 소탕권 한 장이 든다(광고로 채운다).
 *
 * Phaser도 세션도 읽지 않는 순수 모듈이라 서버 경계(`FakeServer`)와 화면이 같은 계산을 쓴다 —
 * 갈리면 화면이 약속한 보상과 실제로 들어온 보상이 다르다.
 */

/** 소탕 한 번에 드는 아이템. 멤버십이 없을 때만 쓴다. */
export const SWEEP_TICKET_ITEM = "sweep-ticket";

/** 임시 지급: 광고 SDK가 없는 웹 빌드에서 소탕을 만져 볼 만큼. 부트가 하한까지 채운다. */
export const SWEEP_TICKET_TEST_KIT = { itemId: SWEEP_TICKET_ITEM, quantity: 10 } as const;

/** 한 번의 소탕 요청이 돌 수 있는 최대 횟수. 스테미나 상한을 넘는 값을 굳이 받지 않는다. */
export const SWEEP_COUNT_LIMIT = 50;

/**
 * 적 레벨 → 한 판의 스테미나. `level` 이상인 첫 칸부터 그 값을 쓴다.
 *
 * 대작전의 여덟 단계가 이 사다리 위에 그대로 서고, 현상수배 등급도 제 레벨로 같은 칸을 읽는다.
 */
export const DUNGEON_STAMINA_LADDER: readonly (readonly [level: number, stamina: number])[] = [
  [1, 6], [10, 8], [15, 10], [20, 12], [26, 14], [32, 16], [38, 18], [45, 20], [50, 22],
];

/** 그 레벨의 적과 한 판 싸우는 데 드는 스테미나. */
export function dungeonRunStamina(level: number): number {
  let stamina = DUNGEON_STAMINA_LADDER[0][1];
  for (const [from, value] of DUNGEON_STAMINA_LADDER) if (level >= from) stamina = value;
  return stamina;
}

/** 한 판의 값. 던전은 이것만 만들어 넘기고 곱하기는 하지 않는다. */
export interface DungeonRunCost {
  /** 한 판에 드는 스테미나다. */
  staminaCost: number;
  /** 한 판을 이겼을 때 받는 재화다. 키는 지갑의 재화 이름이다. */
  rewards: Readonly<Record<string, number>>;
}

/** 소탕 `count`번의 합. */
export interface DungeonSweepSettlement {
  count: number;
  staminaCost: number;
  /** 멤버십이 없을 때 드는 소탕권 수. 멤버십이면 0이다. */
  ticketCost: number;
  rewards: Record<string, number>;
}

/** 어떤 값이든 1 이상 상한 이하의 정수 횟수로 좁힌다. 좁힐 수 없으면 `undefined`다. */
export function normalizeSweepCount(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= SWEEP_COUNT_LIMIT ? value as number : undefined;
}

/**
 * 소탕 `count`번을 더한다. **스테미나와 보상에 같은 수를 곱한다** — 한쪽만 곱하면 횟수가 할인이나
 * 벌금이 되어, 몇 번에 나눠 소탕하는지가 효율을 정하는 숨은 선택이 된다.
 */
export function settleSweep(cost: DungeonRunCost, count: number, adFreeMembership: boolean): DungeonSweepSettlement {
  return {
    count,
    staminaCost: cost.staminaCost * count,
    ticketCost: adFreeMembership ? 0 : count,
    rewards: Object.fromEntries(Object.entries(cost.rewards).map(([currency, amount]) => [currency, amount * count])),
  };
}

/**
 * 지금 한 번에 소탕할 수 있는 최대 횟수 — 「MAX」가 고르는 수다. 스테미나와 (멤버십이 없으면)
 * 소탕권 중 먼저 떨어지는 쪽이 정한다. 한 번도 못 하면 0이다.
 */
export function maxSweepCount(input: { stamina: number; tickets: number; adFreeMembership: boolean; cost: DungeonRunCost }): number {
  const byStamina = input.cost.staminaCost > 0 ? Math.floor(input.stamina / input.cost.staminaCost) : SWEEP_COUNT_LIMIT;
  const byTickets = input.adFreeMembership ? SWEEP_COUNT_LIMIT : input.tickets;
  return Math.max(0, Math.min(SWEEP_COUNT_LIMIT, byStamina, byTickets));
}

/** 소탕을 막는 이유. `null`이면 지금 소탕할 수 있다. */
export type SweepRefusal = "not_cleared" | "invalid_count" | "not_enough_tickets" | "not_enough_stamina";

/** 소탕 가능 여부를 한 곳에서 판정해 화면의 잠금과 서버의 거절이 갈리지 않게 한다. */
export function sweepRefusal(input: {
  cleared: boolean;
  count: number;
  adFreeMembership: boolean;
  tickets: number;
  stamina: number;
  cost: DungeonRunCost;
}): SweepRefusal | null {
  // **이겨 본 단계만 소탕한다.** 전투를 건너뛰는 것이지 이긴 셈 쳐 주는 것이 아니다.
  if (!input.cleared) return "not_cleared";
  if (normalizeSweepCount(input.count) === undefined) return "invalid_count";
  const settlement = settleSweep(input.cost, input.count, input.adFreeMembership);
  if (input.tickets < settlement.ticketCost) return "not_enough_tickets";
  if (input.stamina < settlement.staminaCost) return "not_enough_stamina";
  return null;
}
