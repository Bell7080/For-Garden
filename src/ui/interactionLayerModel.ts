import { INTERACTION_CITIES, type InteractionCity } from "../data/interactionCities";
import { isInteractionCityUnlocked } from "../core/interactionDispatch";
import { t } from "../i18n";
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
  clearedStageIds: ReadonlySet<string>,
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
    // 해금 판정은 서버와 화면이 **같은 한 규칙**을 읽는다. 여기서 다시 비교하면 서버가 거절한
    // 도시가 화면에서만 열려 보인다.
    if (!isInteractionCityUnlocked(city, clearedStageIds)) return { city, state: "locked" as const };
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
 * 남은 시간을 화면 문구로 바꾼다 — **초까지 도는 `00:00:00` 한 모양뿐이다.**
 *
 * 예전에는 길이에 따라 "3시간 20분"과 "30초"를 오갔다. 그러면 같은 자리의 글이 몇 분마다 자리
 * 수까지 바뀌어 층이 들썩였고, 무엇보다 **줄어드는 것이 보이지 않았다** — 3시간짜리 파견은
 * 20분 동안 같은 글자로 서 있었다. 초가 도는 시계는 그 자리에서 기다려도 되는지를 바로 말한다.
 *
 * 시간 자리는 하루를 넘는 파견(24시간)도 그대로 이어 적는다. 남은 시간이 없으면 시계가 아니라
 * 끝났다고 말한다 — `00:00:00`은 다녀왔다는 뜻으로는 읽히지 않는다.
 */
export function interactionRemainingLabel(remainingMs: number): string {
  if (remainingMs <= 0) return t("interaction.done");
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number): string => value.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 자동 배치 — **그 도시에 맞는 이부터, 같으면 센 순서로.**
 *
 * 도시마다 특화 속성·직군·스쿼드가 있고 맞는 칸이 많을수록 더 많이 가져온다
 * (`interactionYieldFactor`). 그래서 맞는 칸 수(`specialty`)가 먼저이고, 같은 수끼리만 전투력으로
 * 가른다. 동률은 ID 순으로 끊어 같은 편성이 늘 같은 결과를 낸다 — 누를 때마다 순서가 바뀌면
 * 자동이 아니라 난수다.
 */
export function autoAssignInteractionParty(
  candidates: readonly { id: string; power: number; specialty?: number }[],
  size: number,
): (string | null)[] {
  const sorted = [...candidates].sort((a, b) => (b.specialty ?? 0) - (a.specialty ?? 0) || b.power - a.power || a.id.localeCompare(b.id));
  return Array.from({ length: size }, (_, index) => sorted[index]?.id ?? null);
}

/**
 * 층 원화를 기울어진 액자에 **어떻게 채울지**.
 *
 * 판은 기울어진 평행사변형이라 좌우에 삼각형이 생기는데, 원화를 그 안쪽 네모로만 넣으면 그
 * 삼각형이 비어 그림이 좌우에서 잘린 것처럼 보인다.
 *
 * - `fill` — 원본이 충분히 커서 **평행사변형 전체를 덮도록 키워도 확대가 되지 않으면**(배율 1
 *   이하) 그만큼 넓혀 채우고 판 실루엣으로 잘라 낸다.
 * - `frame` — 원본이 모자라 넓히면 확대되어 흐려지는 경우, 원화는 안쪽 네모에 두고 좌우
 *   삼각형은 **장식 띠**가 메운다. 흐린 그림보다 의도한 장식이 낫다.
 */
export function interactionArtFit(sourceWidth: number, sourceHeight: number, frameWidth: number, frameHeight: number, slant: number): { mode: "fill" | "frame"; width: number } {
  const full = frameWidth + slant;
  const scale = Math.max(full / Math.max(1, sourceWidth), frameHeight / Math.max(1, sourceHeight));
  return scale <= 1 ? { mode: "fill", width: full } : { mode: "frame", width: frameWidth - slant };
}
