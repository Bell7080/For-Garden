import type { ProgressPassDto } from "../api/contracts";
import type { ProductGrant } from "../data/products";
import { progressPassLevel } from "../core/progressPass";
import { CHAPTERS } from "../data/stages";

/** 지금 받을 수 있는 칸 수 — 무료 칸과(연 패스면) 유료 칸을 함께 센다. 로비 홍보 칸과 받기 버튼이 같은 수를 읽는다. */
export function passReadyCount(pass: Pick<ProgressPassDto, "milestones">): number {
  return pass.milestones.reduce((sum, { freeState, state }) => sum + (freeState === "claimable" ? 1 : 0) + (state === "claimable" ? 1 : 0), 0);
}

/** 패스 레벨과 레벨 단위로 끊긴 게이지의 채움. 서버가 내려 준 마디에서 셈한다(화면이 진행도를 다시 세지 않는다). */
export function passLevelOf(pass: Pick<ProgressPassDto, "milestones" | "progress">): { level: number; max: number; fill: number } {
  return progressPassLevel({ milestones: pass.milestones.map(({ threshold }) => ({ threshold, free: [], rewards: [] })) }, pass.progress);
}

/** 로비에서 창을 열 때 먼저 보여 줄 패스 — 받을 것이 있는 첫 패스, 없으면 맨 앞. */
export function passToOpen(passes: readonly ProgressPassDto[]): ProgressPassDto | undefined {
  return passes.find((pass) => passReadyCount(pass) > 0) ?? passes[0];
}

/**
 * 스토리 패스의 문턱 → 관문 이름(「1-1」). 본편은 한 줄로 이어지므로 클리어 수 n은 곧 n번째 전투 관문이다 —
 * 「관문 3회 클리어」보다 「1-3 클리어」가 어디까지 가야 하는지를 곧바로 말한다. 길이 끝을 넘으면 수를 그대로 적는다.
 */
export function storyPassStageId(clears: number): string {
  const stages = CHAPTERS.flatMap(({ stages: list }) => list).filter(({ kind }) => kind === "battle");
  return stages[clears - 1]?.id ?? String(clears);
}

/**
 * 로비 패스 카드의 액자 한 칸이 보여 줄 보상 — **지금 받을 것**이 있으면 그 첫 칸(무료 먼저, 연 패스면 유료), 없으면
 * **다음에 닿을 마디**의 칸이다(연 패스면 유료가 더 크므로 유료, 아니면 무료). 마디를 다 받았으면 마지막 마디의 칸을
 * `done`으로 돌려 흐리게 세운다. 지급이 하나도 없는 마디는 건너뛴다.
 */
export function passCardReward(pass: Pick<ProgressPassDto, "milestones" | "owned">): { grants: readonly ProductGrant[]; state: "ready" | "next" | "done" } | undefined {
  for (const milestone of pass.milestones) {
    if (milestone.freeState === "claimable" && milestone.free.length > 0) return { grants: milestone.free, state: "ready" };
    if (milestone.state === "claimable" && milestone.rewards.length > 0) return { grants: milestone.rewards, state: "ready" };
  }
  for (const milestone of pass.milestones) {
    if (milestone.freeState !== "locked") continue;
    const paid = pass.owned && milestone.rewards.length > 0 ? milestone.rewards : undefined;
    const grants = paid ?? (milestone.free.length > 0 ? milestone.free : milestone.rewards);
    if (grants.length > 0) return { grants, state: "next" };
  }
  const last = [...pass.milestones].reverse().find((milestone) => milestone.free.length > 0 || milestone.rewards.length > 0);
  return last ? { grants: last.free.length > 0 ? last.free : last.rewards, state: "done" } : undefined;
}
