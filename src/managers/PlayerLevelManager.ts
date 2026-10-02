import { normalizePlayerLevel, PLAYER_LEVEL_CAP } from "../core/playerLevel";
import { saveManager } from "../state/SaveManager";
import { session, type Session } from "../state/session";

/**
 * 연구원 레벨을 직접 만지는 **개발용** 진입점(설정 화면 전용).
 *
 * 콘텐츠가 레벨로 잠겨 있어 QA가 뒤쪽 콘텐츠를 보려면 스테미나를 수천 번 써야 한다. 레벨만 만렙으로 올리고
 * 보상(에너지 드링크)은 주지 않는다 — 정식 경로의 보상 계산을 우회하는 값이라 지급까지 흉내 내지 않는다.
 */
export class PlayerLevelManager {
  constructor(private readonly state: Session = session) {}

  /** 만렙으로 올린다. 이미 만렙이면 false. */
  maxOutForDebug(): boolean {
    if (this.state.playerResearch.level >= PLAYER_LEVEL_CAP) return false;
    this.state.playerResearch = normalizePlayerLevel({ level: PLAYER_LEVEL_CAP, experience: 0 });
    if (this.state === session) saveManager.save(this.state);
    return true;
  }
}

export const playerLevelManager = new PlayerLevelManager();
