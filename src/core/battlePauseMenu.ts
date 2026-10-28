import type { BattleSceneInputDto } from "./expeditionBattle";

/**
 * 일시 정지 판에서 무엇을 세울지 — 전투 모드마다 **그만두는 값**이 다르다.
 *
 * - 스토리·대작전·현상수배는 스테미나를 **이긴 판에서만** 쓴다. 그래서 도중에 나가도, 처음부터 다시
 *   해도 잃는 것이 없다(`leave`). 다시 하기는 편성 화면과 같은 입장을 다시 지난다.
 * - 레이드와 원정 보스는 **친 만큼이 점수**다. 입장이 도전 한 번을 이미 썼으므로 다시 하기는 두지 않고,
 *   나가기는 그 자리에서 판을 끝내 **지금까지의 피해로 정산**한다(`forfeit`).
 * - 결투는 입장이 도전권을 썼으므로 다시 하기가 없고, 나가기는 그 판을 **패배로** 끝낸다(`forfeit`).
 * - **첫 궁극기를 익히는 판(오프닝 1-1)은 판이 아직 시작이다.** 설정(배속·자동 궁극기 같은 조작이 모두 닫혀
 *   있어 만질 것이 없다)과 다시 하기를 빼고, 이어서 · 타이틀로 둘만 세운다(`title`).
 * - 원정 노드는 스무 층 한 판의 한 칸이라 그만두면 그 판 전체가 끝난다. 일시 정지 판에서 잘못 누를
 *   자리를 두지 않는다 — 설정과 계속하기만 선다.
 */
export interface BattlePauseActions {
  retry: boolean;
  /** 설정 줄을 세우나. 첫 궁극기 판은 만질 조작이 없어 세우지 않는다. */
  settings: boolean;
  exit: "leave" | "forfeit" | "title" | null;
}

export function battlePauseActions(mode: BattleSceneInputDto["mode"], intro: boolean = false): BattlePauseActions {
  if (mode === "stage" && intro) return { retry: false, settings: false, exit: "title" };
  if (mode === "stage" || mode === "cake" || mode === "bounty") return { retry: true, settings: true, exit: "leave" };
  // 결투는 도전권을 입장에서 썼다 — 나가면 그 판을 진 것으로 끝낸다.
  // 수호전도 입장이 도전 한 번을 썼다. 판은 입장의 편성·시드가 다 정하므로 나가기는 남은 판을 건너뛰고 확정 결과를 받는다.
  if (mode === "raid" || mode === "expeditionBoss" || mode === "duel" || mode === "guildGuard" || mode === "guildWar") return { retry: false, settings: true, exit: "forfeit" };
  return { retry: false, settings: true, exit: null };
}
