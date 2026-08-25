import type { ClaimMissionRewardsResponse, GameApi, MissionDto } from "../api/contracts";
import type { RewardFrameState } from "./RewardFrame";

/** 표시 모델에서 0 목표 방어와 100% 상한을 끝내 렌더러가 잘못된 비율을 만들지 않게 한다. */
export function missionDisplayModel(mission: MissionDto): MissionDto & { ratio: number; progressLabel: string; state: RewardFrameState; claimable: boolean } {
  const target = Math.max(0, mission.target);
  const progress = Math.max(0, mission.progress);
  const ratio = target === 0 ? (progress > 0 ? 1 : 0) : Math.min(1, progress / target);
  const claimable = !mission.claimed && ratio >= 1;
  return { ...mission, progress, target, ratio, progressLabel: `${progress}/${target}`, state: mission.claimed ? "claimed" : claimable ? "claimable" : "normal", claimable };
}

/** 카드와 아이콘이 같은 수령 경로를 공유하며 진행 중 ID의 중복 요청을 차단한다. */
export class MissionClaimController {
  private readonly pending = new Set<string>();
  constructor(private readonly api: Pick<GameApi, "claimMissionRewards">) {}
  async claim(ids: readonly string[]): Promise<ClaimMissionRewardsResponse | undefined> {
    const unique = [...new Set(ids)];
    if (unique.some((id) => this.pending.has(id))) return undefined;
    unique.forEach((id) => this.pending.add(id));
    try { return await this.api.claimMissionRewards(unique); }
    finally { unique.forEach((id) => this.pending.delete(id)); }
  }
}
