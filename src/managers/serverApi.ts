import { FakeServer, gameApi } from "../api/FakeServer";
import type { GameApi } from "../api/contracts";
import { session, type Session } from "../state/session";

/** 프로필·편성·꾸미기 매니저가 서버에 시키는 일만 모은 좁은 인터페이스다. */
export type ProfileApi = Pick<GameApi, "setParty" | "setFavorite" | "setRelicBookmark" | "updatePlayerCard" | "equipProfileModifiers" | "equipRelicSkin">;
/** 원정 매니저가 서버에 시키는 일만 모은 좁은 인터페이스다. */
export type ExpeditionApi = Pick<GameApi, "startExpeditionRun" | "completeExpeditionRest" | "beginExpeditionAugment" | "chooseExpeditionAugment" | "prepareExpeditionBoss">;
/** 읽음·기록 매니저가 서버에 시키는 일만 모은 좁은 인터페이스다. */
export type RecordApi = Pick<GameApi, "completeStory" | "applyStoryEffect" | "completeObservation" | "markInteractionJournalRead" | "selectArchaeologySite">;

/**
 * 매니저가 쓸 서버 경계를 부르는 순간에 고른다. 공유 세션이면 앱의 `gameApi`, 독립 세션(테스트)이면
 * 그 세션을 소유하는 지연 없는 `FakeServer`다. 모듈이 읽히는 순간에는 고르지 않는다 — FakeServer가
 * 이 매니저들을 import하므로 그 시점에는 `gameApi`가 아직 없다.
 */
export function resolveServerApi<T>(state: Session, injected: T | undefined, cache: { api?: T }): T {
  if (injected) return injected;
  if (state === session) return gameApi as unknown as T;
  return cache.api ??= new FakeServer(state, { latencyMs: 0, persistSession: () => undefined }) as unknown as T;
}
