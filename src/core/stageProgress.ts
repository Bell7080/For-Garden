import type { StageDef } from "./types";

/**
 * 정적 스테이지 배열의 실제 진행 순서로 마지막 클리어 지점을 찾는다.
 * 저장 Set의 삽입 순서와 알 수 없는 구버전 ID는 표시 결과에 영향을 주지 않는다.
 */
/** 알 수 없는 ID는 최초 스테이지로 오인하지 않고 잠금 처리한다. */
export function isStageUnlockedByProgress(stages: readonly StageDef[], stageId: string, cleared: ReadonlySet<string>): boolean {
  const stage = stages.find((candidate) => candidate.id === stageId);
  // 배열 배치와 관계없이 모든 명시적 선행 노드가 완료 집합에 있어야 열린다.
  return stage !== undefined && stage.prerequisiteStageIds.every((id) => cleared.has(id));
}

/** 챕터 번호와 내부 순서를 정적 배열 위치 대신 비교하는 진행 좌표다. */
function progressRank(stage: StageDef): number {
  // 서브 노드는 같은 본편 순번보다 뒤를 대표하지 않게 소수점 성격의 kind 가중치만 둔다.
  return (stage.chapter ?? 0) * 10_000 + (stage.chapterOrder ?? 0) * 2 + (stage.kind === "story" ? 0 : 1);
}

/** 저장 Set 순서와 데이터 배열 배치에 관계없이 가장 높은 본편 클리어를 찾는다. */
export function highestClearedStage(stages: readonly StageDef[], cleared: ReadonlySet<string>): StageDef | undefined {
  return stages.filter((stage) => cleared.has(stage.id)).reduce<StageDef | undefined>((latest, stage) => !latest || progressRank(stage) > progressRank(latest) ? stage : latest, undefined);
}

/** 현재 선행 조건으로 입장 가능한 가장 높은 스테이지를 반환한다. */
export function latestUnlockedStage(stages: readonly StageDef[], cleared: ReadonlySet<string>): StageDef | undefined {
  return stages.filter((stage) => isStageUnlockedByProgress(stages, stage.id, cleared)).reduce<StageDef | undefined>((latest, stage) => !latest || progressRank(stage) > progressRank(latest) ? stage : latest, undefined);
}
