import type { ProgressPassDto } from "../api/contracts";
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
