import { BOUNTY, BOUNTY_TIERS, getBountyTier, type BountyTierDef } from "../data/bounty";
import type { BountyState } from "../state/session";
import { dungeonRunStamina, type DungeonRunCost } from "./dungeonShortcut";

/**
 * 현상수배 한 판의 **진행 규칙**.
 *
 * 이 콘텐츠의 규칙은 한 문장이다 — **세 라운드를 1대1로 치르고 한 번이라도 지면 그 판이 끝난다.**
 * 씬이 그 판단을 복제하면 "졌는데 다음 라운드가 열렸다"가 생긴다. Phaser를 모르고 난수도 쓰지
 * 않는다.
 */

/** 지금 몇 번째 라운드를 치르는지. 0부터 세며 `BOUNTY.roundCount`에서 끝난다. */
export type BountyRoundIndex = 0 | 1 | 2;

/** 전투 씬이 한 라운드를 그리는 데 필요한 전부다. 편성은 저장된 순서를 그대로 읽는다. */
export interface BountyBattleInputDto {
  mode: "bounty";
  tierId: string;
  round: BountyRoundIndex;
  /** 입장 영수증. 세 라운드가 한 판임을 정산 경계가 확인한다. */
  requestId: string;
}

/** 한 라운드가 끝난 뒤 갈 수 있는 곳은 셋뿐이다. */
export type BountyStep =
  /** 다음 라운드로 이어진다. */
  | { kind: "next"; round: BountyRoundIndex }
  /** 세 라운드를 모두 이겼다. 정산은 서버가 한다. */
  | { kind: "clear" }
  /** 한 번 졌으므로 이 판은 여기서 끝난다. */
  | { kind: "defeat"; round: BountyRoundIndex };

/**
 * 그 라운드의 결과가 판을 어디로 보내는가.
 *
 * **진 라운드는 남은 라운드를 열지 않는다.** 시간을 다 써 무승부로 끝난 라운드도 `won: false`로
 * 들어온다 — 죽이지 못한 것은 이긴 것이 아니다(`BOUNTY.limitSeconds`).
 */
export function nextBountyStep(round: BountyRoundIndex, won: boolean): BountyStep {
  if (!won) return { kind: "defeat", round };
  const next = round + 1;
  return next >= BOUNTY.roundCount ? { kind: "clear" } : { kind: "next", round: next as BountyRoundIndex };
}

/** 바로 앞 등급을 깼는지. 1급은 선행이 없어 언제나 열려 있다. */
export function isBountyTierUnlocked(tier: BountyTierDef, clearedTierIds: readonly string[]): boolean {
  const previous = BOUNTY_TIERS.find(({ order }) => order === tier.order - 1);
  return previous === undefined || clearedTierIds.includes(previous.id);
}

/** 화면이 등급 줄을 세울 때 쓰는 해금 스냅샷이다. 잠긴 등급도 목록에서 빼지 않는다. */
export function bountyTierProgress(clearedTierIds: readonly string[]): { tier: BountyTierDef; unlocked: boolean; cleared: boolean }[] {
  return BOUNTY_TIERS.map((tier) => ({ tier, unlocked: isBountyTierUnlocked(tier, clearedTierIds), cleared: clearedTierIds.includes(tier.id) }));
}

/**
 * 단축 규칙(`dungeonShortcut`)이 읽는 한 판의 값. 스테미나는 그 등급의 레벨이 사다리에서 읽는다 —
 * 치즈케이크 대작전과 같은 레벨이면 같은 값이다. 한 등급의 셋은 같은 레벨로 선다.
 */
export function bountyRunCost(tier: BountyTierDef): DungeonRunCost {
  return { staminaCost: dungeonRunStamina(tier.rounds[0].level), rewards: { gold: tier.rewardGold } };
}

/** 세 라운드를 모두 이긴 등급만 다음 등급을 연다. 두 번째 클리어는 목록을 늘리지 않는다. */
export function markBountyTierCleared(state: BountyState, tierId: string): BountyState {
  // 존재하지 않는 등급을 저장에 남기지 않도록 경계에서 확인한다.
  getBountyTier(tierId);
  return state.clearedTierIds.includes(tierId) ? { clearedTierIds: [...state.clearedTierIds] } : { clearedTierIds: [...state.clearedTierIds, tierId] };
}
