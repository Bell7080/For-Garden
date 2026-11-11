import { ALL_GATED_CONTENT, type ContentId } from "./contentUnlock";

/**
 * 새로 열린 콘텐츠를 **들어가 볼 때까지** 기억하는 순수 규칙.
 *
 * 열리는 순간의 자물쇠 연출(`playUnlockSequence`)은 한 번 지나가면 끝이라, 그때 다른 곳을 보고 있었거나 앱을 껐다 켜면
 * 무엇이 새로 생겼는지 화면이 다시 말하지 못했다. 그래서 열린 것과 아직 들르지 않은 것을 기기 설정
 * (`settings.game.contentSeen`)에 남기고, 입구는 들르기 전까지 「NEW」 표식을 단다.
 *
 * - `known` — 마지막으로 본 열림 상태. 이것과 지금을 비교해 **그 사이 새로 열린 것**을 고른다(앱을 껐다 켜도 이어진다).
 * - `fresh` — 열렸지만 아직 들어가 보지 않은 것. 입구를 누르면 빠진다.
 * - `owner` — 그 기록이 누구 것인지(플레이어 UID). 계정이 바뀌면 처음부터 다시 잰다 — 다른 계정의 열림 상태와 비교하면
 *   이미 연 것을 새것으로, 새것을 이미 연 것으로 읽는다.
 *
 * 기록이 없던 저장(이 기능 전의 계정)은 지금 열린 것을 모두 「이미 본 것」으로 시작한다 — 오래 해 온 계정에 NEW가
 * 한꺼번에 서면 무엇이 새것인지 오히려 흐려진다.
 */
export interface ContentSeenState {
  owner: string;
  known: ContentId[];
  fresh: ContentId[];
}

/** 출격 판 안에 서는 콘텐츠 — 로비의 출격 버튼이 이 중 하나라도 새것이면 NEW를 단다. */
export const SORTIE_CONTENT: readonly ContentId[] = ["cakeOperation", "bounty", "raid", "expedition", "ancient"];

const isContentId = (value: unknown): value is ContentId => typeof value === "string" && (ALL_GATED_CONTENT as readonly string[]).includes(value);
const uniqueIds = (values: readonly ContentId[]): ContentId[] => ALL_GATED_CONTENT.filter((id) => values.includes(id));

/** 저장에서 읽은 값을 정리한다. 모양이 틀리면 기록이 없는 것으로 본다. */
export function normalizeContentSeen(value: unknown): ContentSeenState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.owner !== "string" || record.owner.length > 64 || !Array.isArray(record.known)) return null;
  const known = uniqueIds(record.known.filter(isContentId));
  const fresh = Array.isArray(record.fresh) ? uniqueIds(record.fresh.filter(isContentId)).filter((id) => known.includes(id)) : [];
  return { owner: record.owner, known, fresh };
}

/**
 * 지금 열린 목록을 보고 기록을 잇는다. 그 사이 새로 열린 것은 `newly`로 돌려주고 `fresh`에 더한다.
 * 다시 닫힌 것(QA의 레벨 되돌리기)은 `known`·`fresh`에서 함께 빠져, 다시 열리면 또 새것으로 센다.
 */
export function observeOpenContent(state: ContentSeenState | null, owner: string, open: readonly ContentId[]): { state: ContentSeenState; newly: ContentId[] } {
  const known = uniqueIds(open);
  if (!state || state.owner !== owner) return { state: { owner, known, fresh: [] }, newly: [] };
  const newly = known.filter((id) => !state.known.includes(id));
  const fresh = uniqueIds([...state.fresh.filter((id) => known.includes(id)), ...newly]);
  return { state: { owner, known, fresh }, newly };
}

/** 입구를 눌러 들어갔다 — 그 콘텐츠의 NEW를 지운다. */
export function markContentVisited(state: ContentSeenState, id: ContentId): ContentSeenState {
  if (!state.fresh.includes(id)) return state;
  return { ...state, fresh: state.fresh.filter((entry) => entry !== id) };
}

/** 이 중 하나라도 아직 들르지 않은 새것인지. */
export function anyContentFresh(state: ContentSeenState | null, ids: readonly ContentId[]): boolean {
  return !!state && ids.some((id) => state.fresh.includes(id));
}

export function sameContentSeen(a: ContentSeenState | null, b: ContentSeenState | null): boolean {
  if (!a || !b) return a === b;
  return a.owner === b.owner && a.known.join(",") === b.known.join(",") && a.fresh.join(",") === b.fresh.join(",");
}
