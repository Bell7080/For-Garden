import type { CompleteTutorialStepResponse, GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import {
  battleFeatureOpen, battleFeatureToTeach, isTutorialStepDone, lobbyTutorialStep, nextTutorialStep, shouldShowContentIntro, TUTORIAL_STEPS,
  type BattleTutorialFeature, type ContentIntroId, type TutorialStepId,
} from "../core/tutorial";
import { createEmptyTutorialState } from "../core/tutorial";
import { session, type Session } from "../state/session";

/**
 * 첫 플레이 튜토리얼의 **조회와 서버 호출 연결**이다. 칸을 마치는 일(순서 확인·선물 지급·저장)은 전부
 * `GameApi.completeTutorialStep`이 하고, 이 매니저는 화면이 쓸 질문에 답할 뿐 세션을 직접 바꾸지 않는다.
 * 호출이 끝나면 서버가 같은 세션을 이미 갱신했으므로 다시 읽기만 하면 된다.
 */
export class TutorialManager {
  constructor(private readonly state: Session = session, private readonly api: GameApi = gameApi) {}

  private get tutorial() { return this.state.tutorial ?? createEmptyTutorialState(); }

  isDone(step: TutorialStepId): boolean { return isTutorialStepDone(this.tutorial, step); }

  /** 지금 차례인 칸. 모두 마쳤으면 `undefined`. */
  next(): TutorialStepId | undefined { return nextTutorialStep(this.tutorial); }

  /** 전투 조작이 열려 있나(스토리 전투만 튜토리얼에 묶인다). */
  featureOpen(feature: BattleTutorialFeature, storyBattle: boolean): boolean { return battleFeatureOpen(this.tutorial, feature, storyBattle); }

  /** 이번 전투에서 새로 열어 알려 줄 조작. */
  featureToTeach(): BattleTutorialFeature | undefined { return battleFeatureToTeach(this.tutorial); }

  /** 로비가 이어서 안내할 칸(도감 급여 · 선물 · 연구소). */
  lobbyStep(): "feed" | "feedLevel" | "gift" | "pull" | undefined { return lobbyTutorialStep(this.tutorial); }

  /** 이 콘텐츠의 첫 방문 안내를 지금 띄울 차례인가(첫 플레이 튜토리얼을 마쳤고 아직 안 본 것). */
  shouldShowIntro(id: ContentIntroId): boolean { return shouldShowContentIntro(this.tutorial, id); }

  /** 첫 방문 안내를 봤다고 남긴다. 실패해도 안내를 다시 한 번 보는 것뿐이라 삼킨다. */
  async markIntroSeen(id: ContentIntroId): Promise<void> {
    try { await this.api.markContentIntroSeen({ introId: id }); } catch { /* 다음 방문에 한 번 더 뜰 뿐이다 */ }
  }

  /** 칸을 마친다. 오프라인·거절은 삼키고 `undefined`를 돌려준다 — 안내를 못 마쳤다고 판을 막지 않는다. */
  async complete(step: TutorialStepId): Promise<CompleteTutorialStepResponse | undefined> {
    try { return await this.api.completeTutorialStep({ stepId: step }); } catch { return undefined; }
  }

  /** 남은 칸을 앞에서부터 모두 마친다(QA·건너뛰기). 선물이 걸린 칸도 정상 경로로 지급된다. */
  async completeAll(): Promise<void> {
    for (const step of TUTORIAL_STEPS) if (!this.isDone(step)) { if (!await this.complete(step)) return; }
  }
}

export const tutorialManager = new TutorialManager();
