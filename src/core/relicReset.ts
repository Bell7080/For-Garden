import { FEED_UNIT, relicExpToNext } from "./relicProgression";
import type { RelicProgress } from "./types";

/**
 * 캐릭터 초기화 — 레벨을 1로 되돌리고 급여에 쓴 치즈케이크를 돌려받는다(응태 요청, 2026-11-11).
 *
 * **되돌리는 것은 레벨과 경험치뿐이다.** 한계 돌파·공명·유대·룬·외형은 그대로 둔다 — 돌파는 파편을
 * 태워 연 상한이라 되돌리면 그 파편까지 돌려줘야 하고, 그러면 초기화가 돌파 재료 환전소가 된다.
 * 돌파 치즈케이크(`BREAKTHROUGH_STEPS[].cheesecake`)도 돌파의 값이라 돌려주지 않는다.
 *
 * **회수량은 레벨·경험치에서 거꾸로 구한다.** 급여 한 번은 늘 치즈케이크 10 → 경험치 20이고 레벨마다
 * 드는 경험치(`relicExpToNext`)도 20의 배수라, 지금 쌓인 경험치 전체를 급여 단가로 나누면 실제로 먹인
 * 치즈케이크와 정확히 같다(상한에서 넘친 경험치를 버리는 일도 생기지 않는다). 따로 장부를 두지 않으므로
 * 저장 모양이 바뀌지 않는다.
 *
 * **상한 값을 여기 적지 않는다.** 레벨 상한은 다른 축(한계 돌파·연구원 레벨)이 정하고 바뀔 수 있으므로,
 * 이 모듈은 지금 레벨에서 1까지의 거리만 잰다.
 */

/** 이 레벨까지는 젬 없이 초기화한다 — 돌파 없이 닿는 첫 상한과 같은 수지만 상한을 읽지 않는 별개의 선이다. */
export const RELIC_RESET_FREE_MAX_LEVEL = 20;
/** 무료 구간을 넘으면 몇 레벨마다 값이 한 칸 오르는가. */
export const RELIC_RESET_GEM_BAND = 10;
/** 한 칸에 드는 젬. */
export const RELIC_RESET_GEM_PER_BAND = 50;

/** 지금 레벨·경험치에 쌓인 경험치 전체. */
export function relicInvestedExp(progress: Pick<RelicProgress, "level" | "exp">): number {
  let total = Math.max(0, progress.exp);
  for (let level = 1; level < progress.level; level += 1) total += relicExpToNext(level);
  return total;
}

/** 초기화로 돌려받는 치즈케이크(회수율 100%). */
export function relicResetRefund(progress: Pick<RelicProgress, "level" | "exp">): number {
  return Math.floor(relicInvestedExp(progress) / FEED_UNIT.exp) * FEED_UNIT.cheesecake;
}

/**
 * 초기화에 드는 젬.
 *
 * 무료 구간(~20) 뒤로 10레벨 구간마다 50씩 오른다 — 21~30 = 50 · 31~40 = 100 · 41~50 = 150 · 51~60 = 200 (응태 결정, 2026-11-12).
 * 돌려받는 치즈케이크의 젬 환산(무역 시세 젬 1 = 치즈케이크 2)에 견주면 어느 구간에서든 2~3% 남짓이라,
 * 잘못 키운 개체를 바로잡는 수수료로만 읽히고 회수 자체를 망설이게 하지 않는다.
 */
export function relicResetGemCost(level: number): number {
  if (!Number.isInteger(level) || level <= RELIC_RESET_FREE_MAX_LEVEL) return 0;
  return Math.ceil((level - RELIC_RESET_FREE_MAX_LEVEL) / RELIC_RESET_GEM_BAND) * RELIC_RESET_GEM_PER_BAND;
}

/** 되돌릴 것이 있는지 — 레벨 1에 경험치도 없으면 버튼이 꺼진다. */
export function canResetRelic(progress: Pick<RelicProgress, "level" | "exp">): boolean {
  return progress.level > 1 || progress.exp > 0;
}

/** 초기화한 뒤의 진행. 레벨·경험치 말고는 손대지 않는다. */
export function resetRelicProgress(progress: RelicProgress): RelicProgress {
  return { ...progress, level: 1, exp: 0, heartGemSlots: [...progress.heartGemSlots] as RelicProgress["heartGemSlots"] };
}
