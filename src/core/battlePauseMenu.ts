import type { BattleSceneInputDto } from "./expeditionBattle";

/**
 * 일시 정지 판에서 무엇을 세울지 — 전투 모드마다 **그만두는 값**이 다르다.
 *
 * - 스토리·대작전·현상수배는 스테미나를 **이긴 판에서만** 쓴다. 그래서 도중에 나가도, 처음부터 다시
 *   해도 잃는 것이 없다(`leave`). 다시 하기는 편성 화면과 같은 입장을 다시 지난다.
 * - 레이드와 원정 보스는 **친 만큼이 점수**다. 입장이 도전 한 번을 이미 썼으므로 다시 하기는 두지 않고,
 *   나가기는 그 자리에서 판을 끝내 **지금까지의 피해로 정산**한다(`forfeit`).
 * - 원정 노드는 스무 층 한 판의 한 칸이라 그만두면 그 판 전체가 끝난다. 일시 정지 판에서 잘못 누를
 *   자리를 두지 않는다 — 설정과 계속하기만 선다.
 */
export interface BattlePauseActions {
  retry: boolean;
  exit: "leave" | "forfeit" | null;
}

export function battlePauseActions(mode: BattleSceneInputDto["mode"]): BattlePauseActions {
  if (mode === "stage" || mode === "cake" || mode === "bounty") return { retry: true, exit: "leave" };
  if (mode === "raid" || mode === "expeditionBoss") return { retry: false, exit: "forfeit" };
  return { retry: false, exit: null };
}
