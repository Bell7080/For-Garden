import type { AttendanceTrackDto } from "../api/contracts";
import { LOBBY_EVENTS, type LobbyEventDef } from "../data/lobbyEvents";

/**
 * 로비 이벤트 판의 순수 규칙 — 무엇이 서고, 얼마나 남았고, 판이 얼마나 큰가.
 *
 * Phaser 없이 읽히게 두는 이유는 기간 판정과 자리 계산을 화면을 띄우지 않고 테스트로 고정하기
 * 위해서다. 무역 전시장(`tradePackageLayout`)과 같은 문법으로 창 높이를 카드 수에서 거꾸로 구한다.
 */

/** 지금 열려 있는 이벤트만 정의 순서대로 돌려준다. 시작 전·끝난 이벤트는 서지 않는다. */
export function activeLobbyEvents(now: number, events: readonly LobbyEventDef[] = LOBBY_EVENTS): LobbyEventDef[] {
  return events.filter((event) => Date.parse(event.startsAt) <= now && now < Date.parse(event.endsAt));
}

/**
 * 판에 서는 한 장 — 출석(신규·정규)이 먼저, 그 아래 기간 이벤트가 선다.
 *
 * 출석은 매일 누르러 오는 칸이라 맨 위에 둔다. 출석이 서는지는 서버가 정하고(신규는 끝나면 사라진다)
 * 기간 이벤트는 정의의 기간으로 거른다.
 */
export type LobbyEventEntry =
  | { readonly kind: "attendance"; readonly track: AttendanceTrackDto }
  | { readonly kind: "event"; readonly event: LobbyEventDef };

export function lobbyEventEntries(tracks: readonly AttendanceTrackDto[], now: number, events: readonly LobbyEventDef[] = LOBBY_EVENTS): LobbyEventEntry[] {
  return [
    ...tracks.map((track) => ({ kind: "attendance", track }) as const),
    ...activeLobbyEvents(now, events).map((event) => ({ kind: "event", event }) as const),
  ];
}

/** 남은 기간을 한 단위로 줄인다 — 하루 넘게 남으면 일, 한 시간 넘게면 시간, 그 밑은 분(최소 1). */
export type LobbyEventRemaining = { unit: "days" | "hours" | "minutes"; value: number };

export function lobbyEventRemaining(endsAt: string, now: number): LobbyEventRemaining {
  const left = Math.max(0, Date.parse(endsAt) - now);
  const hour = 3_600_000;
  const day = hour * 24;
  // 올려서 센다 — 막 열린 이벤트가 "N-1일"로 서지 않게 한다(가방의 기한 표식과 같은 규칙).
  if (left > day) return { unit: "days", value: Math.ceil(left / day) };
  if (left > hour) return { unit: "hours", value: Math.ceil(left / hour) };
  return { unit: "minutes", value: Math.max(1, Math.ceil(left / 60_000)) };
}

/** 창과 카드의 규격. 값은 이 표에만 있다. */
const BASE = {
  width: 940,
  /** 좌우 안쪽 여백 — 몸판의 깎인 왼쪽 위 모서리 안으로 카드가 들게 한다. */
  padX: 60,
  /**
   * 제목표가 윗변에 걸터앉고, 첫 카드의 SD 머리가 윗변 밖으로 빠져나오므로 그만큼 더 내려 시작한다.
   */
  topPad: 168,
  bottomPad: 84,
  cardHeight: 220,
  /** 출격판처럼 칸 사이를 넉넉히 띄운다 — 아랫칸 SD의 머리가 윗칸 밑변에 닿지 않는다. */
  cardGap: 88,
  /** 카드가 하나도 없을 때도 판이 납작하게 찌그러지지 않는 최소 칸 수. */
  minRows: 2,
} as const;

export interface LobbyEventListLayout {
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
  /** 카드 `count`장이 창 안에서 설 중심 y(창 가운데가 0). */
  centers: number[];
}

/**
 * 카드 `count`장을 담는 창. 높이는 `capacity`장이 쌓인 높이에서 구하므로 마지막 카드가 판 밖으로
 * 나가지 않는다. 창은 정의된 이벤트 수로 한 번 정하고, 그날 열린 카드가 더 적으면 가운데로 모인다.
 */
export function lobbyEventListLayout(count: number, capacity = count): LobbyEventListLayout {
  const rows = Math.max(BASE.minRows, capacity, count);
  const height = BASE.topPad + rows * BASE.cardHeight + (rows - 1) * BASE.cardGap + BASE.bottomPad;
  const top = -height / 2 + BASE.topPad;
  const stack = count * BASE.cardHeight + Math.max(0, count - 1) * BASE.cardGap;
  const start = top + Math.max(0, (height - BASE.topPad - BASE.bottomPad - stack) / 2);
  return {
    width: BASE.width,
    height,
    cardWidth: BASE.width - BASE.padX * 2,
    cardHeight: BASE.cardHeight,
    centers: Array.from({ length: count }, (_, index) => start + BASE.cardHeight / 2 + index * (BASE.cardHeight + BASE.cardGap)),
  };
}
