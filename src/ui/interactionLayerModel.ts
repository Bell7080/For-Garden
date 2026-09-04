import { INTERACTION_CITIES, type InteractionCity } from "../data/interactionCities";
import type { InteractionDispatchSnapshot } from "../state/session";

/**
 * 층 하나가 지금 어떤 상태인지.
 *
 * 화면은 이 넷 말고 다른 상태를 만들지 않는다 — 잠긴 층에 파견 시간이 뜨거나, 다녀온 층이
 * 아직 나가 있는 것처럼 보이는 어긋남은 대부분 상태를 두 곳에서 따로 셀 때 생긴다.
 */
export type InteractionLayerState = "locked" | "idle" | "away" | "done";

export interface InteractionLayerView {
  readonly city: InteractionCity;
  readonly state: InteractionLayerState;
  /** 나가 있거나 다녀온 파견. 비어 있으면 아직 보내지 않았다. */
  readonly dispatch?: InteractionDispatchSnapshot;
  /** 남은 밀리초. 나가 있는 층만 갖는다. */
  readonly remainingMs?: number;
}

/**
 * 위에서 아래로 쌓인 층 목록.
 *
 * **잠긴 층도 목록에 남긴다.** 지워 버리면 다음에 무엇이 열리는지 보이지 않아, 레벨을 올릴
 * 이유가 화면에서 사라진다.
 */
export function interactionLayerViews(
  playerLevel: number,
  dispatches: readonly InteractionDispatchSnapshot[],
  nowMs: number,
  cities: readonly InteractionCity[] = INTERACTION_CITIES,
): InteractionLayerView[] {
  const byCity = new Map<string, InteractionDispatchSnapshot>();
  for (const dispatch of dispatches) {
    if (dispatch.claimed) continue;
    // 같은 도시에 두 장이 오면 늦게 출발한 쪽을 남긴다 — 서버가 막지만 화면도 흔들리지 않게 한다.
    const previous = byCity.get(dispatch.cityId);
    if (!previous || Date.parse(dispatch.startedAt) >= Date.parse(previous.startedAt)) byCity.set(dispatch.cityId, dispatch);
  }
  return cities.map((city) => {
    if (playerLevel < city.unlock.researchLevel) return { city, state: "locked" as const };
    const dispatch = byCity.get(city.id);
    if (!dispatch) return { city, state: "idle" as const };
    const remainingMs = Math.max(0, Date.parse(dispatch.completesAt) - nowMs);
    return remainingMs > 0
      ? { city, state: "away" as const, dispatch, remainingMs }
      : { city, state: "done" as const, dispatch, remainingMs: 0 };
  });
}

/** 지금 어딘가에 나가 있어 다시 보낼 수 없는 렐릭. 파견대 그리드가 이 집합을 빼고 그린다. */
export function relicsAwayOnInteraction(dispatches: readonly InteractionDispatchSnapshot[]): Set<string> {
  const away = new Set<string>();
  for (const dispatch of dispatches) if (!dispatch.claimed) for (const id of dispatch.party) away.add(id);
  return away;
}

/**
 * 남은 시간을 화면 문구로 바꾼다.
 *
 * 초 단위까지 보여 주는 것은 1분 미만일 때뿐이다 — 몇 시간짜리 파견에서 초가 흐르면 읽을 것이
 * 늘기만 하고 다음 조작은 달라지지 않는다.
 */
export function interactionRemainingLabel(remainingMs: number): string {
  if (remainingMs <= 0) return "완료";
  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}초`;
  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours}시간` : `${hours}시간 ${restMinutes}분`;
}
