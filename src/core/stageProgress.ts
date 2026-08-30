import type { StageDef } from "./types";

/**
 * 정적 스테이지 배열의 실제 진행 순서로 마지막 클리어 지점을 찾는다.
 * 저장 Set의 삽입 순서와 알 수 없는 구버전 ID는 표시 결과에 영향을 주지 않는다.
 */
export function highestClearedStage(stages: readonly StageDef[], cleared: ReadonlySet<string>): StageDef | undefined {
  // 뒤에서부터 찾으면 분기 없는 현재 선형 정의에서 가장 높은 정적 순서를 정확히 보존한다.
  for (let index = stages.length - 1; index >= 0; index -= 1) {
    if (cleared.has(stages[index].id)) return stages[index];
  }
  return undefined;
}
