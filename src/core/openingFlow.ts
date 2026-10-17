/**
 * 오프닝 → 1-1 전투를 아직 끝까지 보지 못했나. 오프닝 이야기는 전투 앞에서 완료로 저장되므로
 * 그 값만 보면 1-1 도중에 타이틀로 나간 계정이 곧장 로비로 들어가 튜토리얼 전투를 건너뛴다.
 * 1-1 클리어가 곧 "처음 한 판을 끝냈다"는 표식이라, 그 전까지는 타이틀 입장이 오프닝부터 다시 시작한다.
 */
export const OPENING_STAGE_ID = "1-1";

export function openingPending(openingCompleted: boolean, clearedStageIds: ReadonlySet<string> | readonly string[]): boolean {
  if (!openingCompleted) return true;
  return Array.isArray(clearedStageIds) ? !clearedStageIds.includes(OPENING_STAGE_ID) : !(clearedStageIds as ReadonlySet<string>).has(OPENING_STAGE_ID);
}
