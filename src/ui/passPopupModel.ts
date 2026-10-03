import type { ProgressPassDto } from "../api/contracts";
import { progressPassLevel } from "../core/progressPass";

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
