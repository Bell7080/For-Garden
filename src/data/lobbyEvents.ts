import type { TextKey } from "../i18n";
import { BACKGROUND } from "../ui/backgroundAssets";

/**
 * 로비 이벤트 목록.
 *
 * 로비 오른쪽 줄의 노란 이벤트 입구가 여는 판에 한 장씩 선다. 한 이벤트가 곧 한 카드이고,
 * 카드를 누르면 그 이벤트의 화면(`EventScene`)으로 넘어간다.
 *
 * **지금은 연결선만 있다.** 이벤트마다 무엇을 하는지(출석·교환·전용 스테이지)는 아직 정하지
 * 않았으므로 여기에는 이름·부제·기간만 두고, 화면은 그 셋을 세운 빈 무대다. 이벤트가 제 내용을
 * 갖게 되면 이 정의에 그 종류를 더하고 `EventScene`이 종류를 읽어 갈아 끼운다.
 *
 * 문구는 키로만 든다 — 이벤트는 운영이 늘리고 걷는 목록이라 이름을 데이터 파일에 한국어로 박아
 * 두면 언어마다 덮어쓸 자리를 따로 등록해야 한다(`shopPresentation.ts`와 같은 방식이다).
 */
export interface LobbyEventDef {
  readonly id: string;
  readonly titleKey: TextKey;
  readonly subtitleKey: TextKey;
  /** ISO 시각. 기기 시계로 재며, 실제 서버가 생기면 서버 시각으로 옮긴다. */
  readonly startsAt: string;
  readonly endsAt: string;
  /**
   * 카드 뒷배경으로 까는 원화 키. 이벤트마다 어울리는 그림을 깔고 카드 구성도 그 그림의 결에
   * 맞춘다. 비워 두면 기본 카드(유리 판)로 선다.
   */
  readonly backdropKey?: string;
  /**
   * 카드를 눌렀을 때 가는 곳. 비워 두면 이벤트 화면(`EventScene`)이다. 이미 있는 콘텐츠를 알리는
   * 이벤트는 새 씬을 만들지 않고 그 콘텐츠로 곧장 잇는다(예: 픽업 모집).
   */
  readonly destination?: LobbyEventDestination;
}

/** 이벤트 카드가 여는 곳. */
export type LobbyEventDestination = { readonly kind: "lab"; readonly bannerId: string };

/** 목록에 서는 순서가 곧 이 배열의 순서다. */
export const LOBBY_EVENTS: readonly LobbyEventDef[] = [
  {
    id: "wolf-cafe",
    titleKey: "event.wolfCafe.title",
    subtitleKey: "event.wolfCafe.subtitle",
    backdropKey: BACKGROUND.recruitDian,
    // 디안 픽업 이벤트는 새 화면이 아니라 디안이 선 호박석 연구(픽업 모집)로 곧장 간다.
    destination: { kind: "lab", bannerId: "amber" },
    startsAt: "2026-09-01T00:00:00+09:00",
    endsAt: "2026-12-31T23:59:59+09:00",
  },
  {
    id: "autumn-harvest",
    titleKey: "event.autumnHarvest.title",
    subtitleKey: "event.autumnHarvest.subtitle",
    startsAt: "2026-09-01T00:00:00+09:00",
    endsAt: "2026-12-31T23:59:59+09:00",
  },
];

/** ID로 이벤트를 찾는다. 모르는 ID는 `undefined` — 화면이 로비로 되돌아간다. */
export function findLobbyEvent(id: unknown): LobbyEventDef | undefined {
  return typeof id === "string" ? LOBBY_EVENTS.find((event) => event.id === id) : undefined;
}
