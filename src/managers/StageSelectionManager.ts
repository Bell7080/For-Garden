import { getStage } from "../data/stages";
import { isStageUnlocked, session } from "../state/session";
import { saveManager } from "../state/SaveManager";

/** 선택은 기기 취향이다. 원격 게임 진행을 수정하지 않고 로컬 저장만 갱신한다. */
export function selectStoryStage(id: string): boolean {
  const stage = getStage(id);
  if (stage.kind !== "battle" || !isStageUnlocked(id)) return false;
  const previous = session.selectedStageId;
  session.selectedStageId = id;
  try { saveManager.save(session); } catch { session.selectedStageId = previous; return false; }
  return true;
}
