import type { ProgressPassDefinition } from "../data/progressPasses";

/**
 * 진행 패스 마디 하나의 상태.
 *
 * - `claimed` — 받았다.
 * - `claimable` — 패스를 열었고 그 마디에 닿았다. 지금 받을 수 있다.
 * - `reached` — 그 마디에 닿았지만 패스를 아직 열지 않았다. **열면 곧바로 받는다**(소급) — 화면은 이 칸을
 *   "사면 받는 것"으로 보여 준다.
 * - `locked` — 아직 닿지 않았다.
 */
export type ProgressPassMilestoneState = "claimed" | "claimable" | "reached" | "locked";

/**
 * 마디마다의 상태. 서버와 화면이 같은 함수를 읽는다 — 한쪽만 소급 규칙을 바꾸면 화면이 받을 수 있다고 한 칸을
 * 서버가 거절한다.
 */
export function progressPassMilestoneStates(
  pass: Pick<ProgressPassDefinition, "milestones">,
  progress: number,
  owned: boolean,
  claimed: readonly number[],
): ProgressPassMilestoneState[] {
  const taken = new Set(claimed);
  return pass.milestones.map(({ threshold }) => {
    if (taken.has(threshold)) return "claimed";
    if (progress < threshold) return "locked";
    return owned ? "claimable" : "reached";
  });
}

/** 지금 받을 수 있는 마디의 문턱값들. */
export function claimableProgressPassThresholds(
  pass: Pick<ProgressPassDefinition, "milestones">,
  progress: number,
  owned: boolean,
  claimed: readonly number[],
): number[] {
  const states = progressPassMilestoneStates(pass, progress, owned, claimed);
  return pass.milestones.flatMap(({ threshold }, index) => states[index] === "claimable" ? [threshold] : []);
}

/** 길의 끝 — 마지막 마디의 문턱값. 진행도 줄의 분모다. */
export function progressPassGoal(pass: Pick<ProgressPassDefinition, "milestones">): number {
  return pass.milestones[pass.milestones.length - 1]?.threshold ?? 0;
}
