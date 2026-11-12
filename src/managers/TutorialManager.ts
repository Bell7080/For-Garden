import type { CompleteTutorialStepResponse, GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import {
  tutorialBattleStage, battleFeatureOpen, battleFeatureToTeach, isTutorialStepDone, lobbyTutorialGateStage, lobbyTutorialStep, nextTutorialStep, shouldShowContentIntro, TUTORIAL_STEPS,
  type BattleTutorialFeature, type ContentIntroId, type TutorialStepId,
} from "../core/tutorial";
import { createCompletedTutorialState, createEmptyTutorialState, freeRuneCraftId } from "../core/tutorial";
import { managerEvents } from "./ManagerEvents";
import { TUTORIAL_ENABLED } from "../core/buildFlavor";
import { session, type Session } from "../state/session";

/**
 * 첫 플레이 튜토리얼의 **조회와 서버 호출 연결**이다. 칸을 마치는 일(순서 확인·선물 지급·저장)은 전부
 * `GameApi.completeTutorialStep`이 하고, 이 매니저는 화면이 쓸 질문에 답할 뿐 세션을 직접 바꾸지 않는다.
 * 호출이 끝나면 서버가 같은 세션을 이미 갱신했으므로 다시 읽기만 하면 된다.
 */
export class TutorialManager {
  constructor(private readonly state: Session = session, private readonly api: GameApi = gameApi, private readonly enabled: boolean = TUTORIAL_ENABLED) {}

  /**
   * 화면이 읽는 튜토리얼 상태. 튜토리얼을 끈 빌드(QA)에서는 **모두 마친 상태로 읽는다** — 화면마다 빌드를 가르지
   * 않고 이 한 곳만 바꾸면 안내·조작 잠금·첫 방문 안내가 함께 사라진다. 서버의 진행 기록은 건드리지 않는다.
   */
  private get tutorial() {
    if (!this.enabled) return createCompletedTutorialState();
    return this.state.tutorial ?? createEmptyTutorialState();
  }

  isDone(step: TutorialStepId): boolean { return isTutorialStepDone(this.tutorial, step); }

  /** 지금 차례인 칸. 모두 마쳤으면 `undefined`. */
  next(): TutorialStepId | undefined { return nextTutorialStep(this.tutorial); }

  /** 전투 조작이 열려 있나(스토리 전투만 튜토리얼에 묶인다). */
  featureOpen(feature: BattleTutorialFeature, storyBattle: boolean): boolean { return battleFeatureOpen(this.tutorial, feature, storyBattle); }

  /** 이번 전투에서 새로 열어 알려 줄 조작. */
  featureToTeach(): BattleTutorialFeature | undefined { return battleFeatureToTeach(this.tutorial); }

  battleStage(): string | undefined {
    if (this.next() !== undefined && !this.state.cleared.has("1-1")) return "1-1";
    return tutorialBattleStage(this.tutorial);
  }

  /** 로비가 이어서 안내할 칸(도감 급여 · 선물 · 연구소). */
  lobbyStep(): "feed" | "feedLevel" | "gift" | "pull" | undefined {
    const step = lobbyTutorialStep(this.tutorial);
    return step !== undefined && this.state.cleared.has(lobbyTutorialGateStage(step)) ? step : undefined;
  }

  /** 이 콘텐츠의 첫 방문 안내를 지금 띄울 차례인가(첫 플레이 튜토리얼을 마쳤고 아직 안 본 것). */
  shouldShowIntro(id: ContentIntroId): boolean { return shouldShowContentIntro(this.tutorial, id); }

  /** 첫 방문 안내를 봤다고 남긴다. 실패해도 안내를 다시 한 번 보는 것뿐이라 삼킨다. */
  async markIntroSeen(id: ContentIntroId): Promise<void> {
    try { await this.api.markContentIntroSeen({ introId: id }); } catch { /* 다음 방문에 한 번 더 뜰 뿐이다 */ }
  }

  /**
   * 무료 각인 체험의 대상 룬. 체험이 서 있고, 그 룬이 아직 가방에 있고, 각인 전일 때만 있다 — 판 룬을 팔거나
   * 합성해 사라졌으면 체험도 조용히 없는 것으로 읽는다(서버도 없는 룬에는 아무것도 깎아 주지 않는다).
   */
  freeRuneId(): string | undefined {
    if (!this.enabled) return undefined;
    const id = freeRuneCraftId(this.state.tutorial);
    if (id === undefined) return undefined;
    const rune = this.state.runeInventory.find((candidate) => candidate.instanceId === id);
    return rune && rune.engravings.length === 0 ? id : undefined;
  }

  /** 체험을 건너뛴다. 가방 점이 곧바로 꺼지도록 가방 신호를 한 번 낸다. */
  async dismissFreeRune(): Promise<boolean> {
    try { await this.api.dismissFreeRuneCraft({ reason: "skip" }); managerEvents.publishInventory(); return true; } catch { return false; }
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
