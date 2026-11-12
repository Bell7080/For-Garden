import { FEED_UNIT, relicExpToNext } from "./relicProgression";
import type { RelicProgress } from "./types";

/**
 * 캐릭터 초기화 — 레벨을 1로 되돌리고 급여에 쓴 치즈케이크를 돌려받는다(응태 요청, 2026-11-11).
 *
 * **되돌리는 것은 레벨과 경험치뿐이다.** 한계 돌파·공명·유대·룬·외형은 그대로 둔다 — 돌파는 파편을
 * 태워 연 상한이라 되돌리면 그 파편까지 돌려줘야 하고, 그러면 초기화가 돌파 재료 환전소가 된다.
 * 돌파 치즈케이크(`BREAKTHROUGH_STEPS[].cheesecake`)도 돌파의 값이라 돌려주지 않는다.
 *
 * **21레벨까지는 다 돌려주고 그 위는 90%다**(응태 결정, 2026-11-12 — 젬을 받던 방식을 걷었다). 잘못 키운 개체를
 * 바로잡는 값은 젬이 아니라 돌려받지 못하는 치즈케이크 몫으로 치른다.
 *
 * **회수량은 레벨·경험치에서 거꾸로 구한다.** 급여 한 번은 늘 치즈케이크 10 → 경험치 20이고 레벨마다
 * 드는 경험치(`relicExpToNext`)도 20의 배수라, 지금 쌓인 경험치 전체를 급여 단가로 나누면 실제로 먹인
 * 치즈케이크와 정확히 같다(상한에서 넘친 경험치를 버리는 일도 생기지 않는다). 따로 장부를 두지 않으므로
 * 저장 모양이 바뀌지 않는다.
 *
 * **상한 값을 여기 적지 않는다.** 레벨 상한은 다른 축(한계 돌파·연구원 레벨)이 정하고 바뀔 수 있으므로,
 * 이 모듈은 지금 레벨에서 1까지의 거리만 잰다.
 */

/**
 * 이 레벨까지 쌓은 몫은 전부 돌려준다 — 1레벨에서 「10 레벨」 급여를 두 번 누르면 닿는 자리다(응태 결정, 2026-11-12).
 * 돌파 없이 닿는 상한(20)과 비슷한 수지만 상한을 읽지 않는 별개의 선이다.
 */
export const RELIC_RESET_FULL_REFUND_LEVEL = 21;
/** 그 선을 넘겨 쌓은 몫에서 돌려주는 비율(%). 나머지 10%가 초기화의 값이다 — 젬은 들지 않는다. */
export const RELIC_RESET_REFUND_PERCENT = 90;

/** 지금 레벨·경험치에 쌓인 경험치 전체. */
export function relicInvestedExp(progress: Pick<RelicProgress, "level" | "exp">): number {
  let total = Math.max(0, progress.exp);
  for (let level = 1; level < progress.level; level += 1) total += relicExpToNext(level);
  return total;
}

/** 급여로 먹인 치즈케이크 전체 — 경험치를 급여 단가로 나누면 실제로 먹인 양과 정확히 같다. */
export function relicInvestedCheesecake(progress: Pick<RelicProgress, "level" | "exp">): number {
  return Math.floor(relicInvestedExp(progress) / FEED_UNIT.exp) * FEED_UNIT.cheesecake;
}

/**
 * 초기화로 돌려받는 치즈케이크.
 *
 * 21레벨까지 쌓은 몫은 100%, 그 위(22레벨로 가는 몫부터)는 90%다. 구간을 레벨 하나로 끊으면 21과 22 사이에서
 * 앞의 21레벨 몫까지 한꺼번에 10%가 깎이는 낭떠러지가 생기므로, **넘긴 몫에만** 비율을 건다 — 어느 레벨에서
 * 초기화하든 한 레벨 더 키운 만큼만 손해가 는다. 돌려주는 수는 내림한다.
 */
export function relicResetRefund(progress: Pick<RelicProgress, "level" | "exp">): number {
  const invested = relicInvestedCheesecake(progress);
  const safe = Math.min(invested, relicInvestedCheesecake({ level: RELIC_RESET_FULL_REFUND_LEVEL, exp: 0 }));
  return safe + Math.floor(((invested - safe) * RELIC_RESET_REFUND_PERCENT) / 100);
}

/** 초기화로 잃는 치즈케이크 — 먹인 것과 돌려받는 것의 차. 21레벨까지는 0이다. */
export function relicResetLoss(progress: Pick<RelicProgress, "level" | "exp">): number {
  return relicInvestedCheesecake(progress) - relicResetRefund(progress);
}

/** 되돌릴 것이 있는지 — 레벨 1에 경험치도 없으면 버튼이 꺼진다. */
export function canResetRelic(progress: Pick<RelicProgress, "level" | "exp">): boolean {
  return progress.level > 1 || progress.exp > 0;
}

/** 초기화한 뒤의 진행. 레벨·경험치 말고는 손대지 않는다. */
export function resetRelicProgress(progress: RelicProgress): RelicProgress {
  return { ...progress, level: 1, exp: 0, heartGemSlots: [...progress.heartGemSlots] as RelicProgress["heartGemSlots"] };
}
