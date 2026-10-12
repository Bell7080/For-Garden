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
   * 카드 뒷배경으로 까는 원화 키 — **필수다.** 모든 이벤트 카드는 디안 픽업 카드와 같은 한 양식
   * (원화 · 왼쪽 빗금 · 제목 · 부제 한 줄 · 붉은 기간 시계 · SD)으로 서고, 원화가 없는 카드는 그 양식에서
   * 빈 판으로 떨어져 덜 만든 것처럼 읽힌다. 부제는 설명문이 아니라 무엇을 하는 이벤트인지 한 마디다
   * (「디안 한정 픽업 이벤트!」).
   */
  readonly backdropKey: string;
  /**
   * 원화의 어느 부분을 카드에 세우는가 — 카드 폭 대비 확대(`zoom`, 1이면 폭에 꼭 맞춘다)와 원화를 옮기는
   * 거리. 세로로 긴 모집 원화는 가운데를 자르면 무릎께가 서므로 얼굴께가 오도록 내린다.
   */
  readonly backdropFrame?: { readonly zoom: number; readonly offsetX: number; readonly offsetY: number };
  /** 카드에 세우는 SD. 출격판처럼 몸은 칸 안에 갇히고 머리만 윗변 밖으로 빠져나온다. */
  readonly sd?: { readonly relicId: string; readonly side: "left" | "right" };
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
    // 모집 원화는 세로로 길어 그대로 자르면 무릎께가 선다 — 한 뼘 키워 얼굴께를 카드 가운데로 내린다.
    backdropFrame: { zoom: 1.22, offsetX: 90, offsetY: 336 },
    sd: { relicId: "dian", side: "right" },
    // 디안 픽업 이벤트는 새 화면이 아니라 디안이 선 호박석 연구(픽업 모집)로 곧장 간다.
    destination: { kind: "lab", bannerId: "amber" },
    startsAt: "2026-09-01T00:00:00+09:00",
    endsAt: "2026-12-31T23:59:59+09:00",
  },
  {
    id: "autumn-harvest",
    titleKey: "event.autumnHarvest.title",
    subtitleKey: "event.autumnHarvest.subtitle",
    backdropKey: BACKGROUND.interactionDoppelParlor,
    startsAt: "2026-09-01T00:00:00+09:00",
    endsAt: "2026-12-31T23:59:59+09:00",
  },
];

/** ID로 이벤트를 찾는다. 모르는 ID는 `undefined` — 화면이 로비로 되돌아간다. */
export function findLobbyEvent(id: unknown): LobbyEventDef | undefined {
  return typeof id === "string" ? LOBBY_EVENTS.find((event) => event.id === id) : undefined;
}
