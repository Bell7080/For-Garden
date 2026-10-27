/**
 * **자동 전투(반복 출격)** — 던전(치즈케이크 대작전·현상수배)의 같은 단계를 같은 편성으로 이어서 도는 규칙.
 *
 * 옵션은 수집형 RPG가 흔히 두는 셋만 둔다 — **반복 횟수**, **패배 시 중단**, **에너지 드링크 자동 사용**.
 * 젬으로 스테미나를 사는 길은 자동으로 열지 않는다 — 되돌릴 수 없는 재화라 사람이 확인 창을 지나야 한다.
 *
 * 다음 판으로 갈지, 병을 먼저 딸지, 멈출지는 이 순수 함수 하나가 정한다. 씬은 그 답을 따르기만 한다 —
 * 씬이 조건을 저마다 적으면 "졌는데 다음 판이 열렸다"가 생긴다.
 */

/** 반복 횟수 선택지. 0은 「스테미나가 떨어질 때까지」다. */
export const AUTO_REPEAT_RUN_CHOICES = [5, 10, 20, 50, 0] as const;
export type AutoRepeatRuns = (typeof AUTO_REPEAT_RUN_CHOICES)[number];

export interface AutoRepeatOptions {
  runs: AutoRepeatRuns;
  /** 진 판에서 멈춘다. 끄면 진 판도 세고 다음 판으로 간다(진 판은 스테미나를 쓰지 않는다). */
  stopOnDefeat: boolean;
  /** 스테미나가 모자라면 가방의 에너지 드링크를 딴다. */
  autoDrink: boolean;
}

export const DEFAULT_AUTO_REPEAT_OPTIONS: AutoRepeatOptions = { runs: 10, stopOnDefeat: true, autoDrink: false };

/** 다음 판 전의 숨 고르기(실제 시간). 결과판을 한 번은 읽을 수 있어야 한다. */
export const AUTO_REPEAT_COUNTDOWN_MS = 3_000;

/** 자동으로 딸 수 있는 병 — 가방에 있는 것만 넘긴다. */
export interface AutoRepeatDrink {
  itemId: string;
  quantity: number;
  /** 한 병의 회복량. */
  amount: number;
  /** 가장 먼저 사라질 묶음의 만료 시각(ms). 기한이 없으면 비운다. */
  expiresAt?: number;
}

export type AutoRepeatStopReason = "done" | "defeat" | "stamina" | "cancelled";

export type AutoRepeatDecision =
  | { kind: "continue" }
  | { kind: "drink"; itemId: string }
  | { kind: "stop"; reason: AutoRepeatStopReason };

/** 저장 값을 선택지 안으로 좁힌다. */
export function normalizeAutoRepeatOptions(value: unknown): AutoRepeatOptions {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const d = DEFAULT_AUTO_REPEAT_OPTIONS;
  return {
    runs: (AUTO_REPEAT_RUN_CHOICES as readonly number[]).includes(record.runs as number) ? record.runs as AutoRepeatRuns : d.runs,
    stopOnDefeat: typeof record.stopOnDefeat === "boolean" ? record.stopOnDefeat : d.stopOnDefeat,
    autoDrink: typeof record.autoDrink === "boolean" ? record.autoDrink : d.autoDrink,
  };
}

/**
 * 딸 병 하나 — 가장 먼저 사라질 것부터, 같으면 작은 것부터. 사라질 병을 먼저 써야 버려지는 몫이 없다.
 */
export function pickAutoDrink(drinks: readonly AutoRepeatDrink[]): AutoRepeatDrink | undefined {
  return [...drinks].filter(({ quantity, amount }) => quantity > 0 && amount > 0)
    .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity) || a.amount - b.amount)[0];
}

/**
 * 한 판이 끝난 뒤의 다음 걸음.
 *
 * - `completed`는 방금 끝난 판까지 센 수다.
 * - 진 판은 `stopOnDefeat`이면 멈춘다.
 * - 정한 횟수를 채웠으면 멈춘다(0은 끝없이).
 * - 다음 판의 스테미나가 모자라면 병을 따거나(켰고 가졌으면) 멈춘다.
 */
export function nextAutoRepeatStep(input: {
  options: AutoRepeatOptions;
  completed: number;
  won: boolean;
  stamina: number;
  staminaCost: number;
  drinks: readonly AutoRepeatDrink[];
}): AutoRepeatDecision {
  const { options } = input;
  if (!input.won && options.stopOnDefeat) return { kind: "stop", reason: "defeat" };
  if (options.runs > 0 && input.completed >= options.runs) return { kind: "stop", reason: "done" };
  if (input.stamina >= input.staminaCost) return { kind: "continue" };
  const drink = options.autoDrink ? pickAutoDrink(input.drinks) : undefined;
  return drink ? { kind: "drink", itemId: drink.itemId } : { kind: "stop", reason: "stamina" };
}
