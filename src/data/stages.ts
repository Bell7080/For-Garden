import { applyLevelGrowth } from "../core/relicProgression";
import type { RelicDef, StageDef } from "../core/types";
import { getRelic } from "./relics";

/** 임시 고정 편성: 1번 토비 · 2번 아모 · 3번 리파 순서로 모든 스테이지에 등장한다. */
export const FIXED_STAGE_ENEMIES: StageDef["enemies"] = ["husk-raptor", "husk-shell", "husk-wing"];

/**
 * 스테이지. 지도에서 아래에서 위로 올라가는 순서 그대로다.
 * 적은 언제나 3명으로 구성된다.
 */
export const STAGES: StageDef[] = [
  "격리 구역", "붕괴한 온실", "침수된 배양실", "표본 보관고", "제1구역 관제탑",
  "무너진 통신소", "폐기물 처리장", "지하 배수로", "봉쇄된 정거장", "구역 경계문",
].map((name, index) => ({
  id: `1-${index + 1}`,
  name,
  // 배열을 복사해 한 스테이지의 편성 변경이 다른 스테이지까지 번지지 않게 한다.
  enemies: [...FIXED_STAGE_ENEMIES],
  enemyLevel: index + 1,
  // 최초 보상은 탐험 진척을, 반복 보상은 이후 성장 파밍을 장려하는 잡초 수량이다.
  rewards: { firstClearWeeds: 30 + index * 5, repeatClearWeeds: 10 + index * 2 },
}));

/** 대규모 던전 대신 하루 세 번만 보상을 받을 수 있는 단일 복원 훈련이다. */
export const DAILY_RESTORATION = {
  id: "daily-restoration",
  name: "일일 복원",
  maxEntriesPerUtcDay: 3,
  rewardWeeds: 40,
} as const;

export function getStage(id: string): StageDef {
  const found = STAGES.find((s) => s.id === id);
  if (!found) throw new Error(`알 수 없는 스테이지 id: ${id}`);
  return found;
}

/** 기존 레벨당 +2% 성장 규칙을 적용하되 원본 적 데이터는 바꾸지 않는다. */
export function getStageEnemies(stage: StageDef): [RelicDef, RelicDef, RelicDef] {
  return stage.enemies.map((id) => {
    const base = getRelic(id);
    return { ...base, stats: applyLevelGrowth(base.stats, stage.enemyLevel) };
  }) as [RelicDef, RelicDef, RelicDef];
}
