/**
 * 로비 입구 버튼 넷(출격·교류·발굴·결투)의 생김새 한 표 — 로비와 레벨업 판이 같은 값을 읽는다.
 *
 * 출격만 크고 무거운 강조 판이고, 나머지 셋은 **한 단계 작은 같은 크기**의 「입구 판」(`variant: "entrance"`)이다.
 * 셋이 같은 푸른 유리판이던 때는 무엇이 교류이고 무엇이 발굴인지 글자를 읽어야 갈렸다 — 이제 **색 한 벌 + 무늬 하나**가
 * 저마다 다르다. 무늬는 판의 바깥(키 큰) 변에서 안쪽으로 옅어지는 한 가지 결뿐이고 한 번 구워 세운다(`Button`의 `motif`).
 *
 * 글 양식도 넷이 같다: 큰 라벨 아래 **라틴 문자 메아리**(`latinEcho` — 라벨이 라틴 문자가 아닐 때만 선다) 한 줄.
 * 한 버튼만 「자원 수집」 같은 풀이 부제를 달던 것은 걷었다 — 이름이 이미 말한다.
 *
 * Phaser를 읽지 않는다 — 테스트가 같은 표로 크기·글 양식을 지킨다.
 */
import type { ButtonOptions } from "./Button";
import { latinEcho } from "./latinEcho";

export type LobbyEntranceId = "sortie" | "interaction" | "excavation" | "duel";
export type EntranceMotif = "dots" | "streams" | "strata" | "slashes";

export interface LobbyEntranceSpec {
  /** 판 크기. 출격만 크고 셋은 같다. */
  width: number;
  height: number;
  fontSize: number;
  /** 라벨 아래 라틴 문자 메아리 — 라벨이 라틴 문자면 서지 않는다. */
  echo: string;
  subFontSize: number;
  /** 키 큰 변(화면 가장자리 쪽). 왼쪽 열은 `left`, 오른쪽 열은 `right`. */
  perspective: "left" | "right";
  tilt: number;
  accent: number;
  /** 메아리 글자색. */
  accentText: string;
  motif: EntranceMotif;
}

/** 작은 입구 판 셋이 함께 쓰는 크기 — 출격보다 한 단계 작다. */
export const LOBBY_ENTRANCE_SIZE = { width: 292, height: 106, fontSize: 34, subFontSize: 20 } as const;

export const LOBBY_ENTRANCE: Record<LobbyEntranceId, LobbyEntranceSpec> = {
  // 출격 — 주황 강조 판 + 양 끝의 점 무늬. 로비의 주 조작이라 가장 크다.
  sortie: { width: 520, height: 170, fontSize: 52, echo: "SORTIE", subFontSize: 26, perspective: "right", tilt: -6, accent: 0xd85f34, accentText: "#f08b62", motif: "dots" },
  // 교류 — 하늘빛 + 바깥 변에서 흘러드는 가는 신호선(다른 도시와 오가는 것).
  interaction: { ...LOBBY_ENTRANCE_SIZE, echo: "EXCHANGE", perspective: "left", tilt: 6, accent: 0x6fa8d6, accentText: "#9fd0f0", motif: "streams" },
  // 발굴 — 청록 + 밑동에 쌓인 지층 띠(묻힌 것을 걷어 올리는 것).
  excavation: { ...LOBBY_ENTRANCE_SIZE, echo: "EXCAVATION", perspective: "left", tilt: 6, accent: 0x4fbf9f, accentText: "#8fe0c6", motif: "strata" },
  // 결투 — 다홍빛 + 바깥 변의 빗금(맞부딪히는 칼자국).
  duel: { ...LOBBY_ENTRANCE_SIZE, echo: "DUEL", perspective: "right", tilt: -6, accent: 0xd04a5e, accentText: "#f08a98", motif: "slashes" },
};

/**
 * 입구 판의 `Button` 옵션(누름 처리 제외). 로비와 레벨업 판이 같은 함수를 지나 같은 판을 세운다.
 * 라벨은 부르는 쪽이 번역해 넘긴다 — 메아리는 그 라벨이 라틴 문자가 아닐 때만 선다.
 */
export function lobbyEntranceButton(id: LobbyEntranceId, label: string): Omit<ButtonOptions, "onClick"> {
  const spec = LOBBY_ENTRANCE[id];
  const sub = latinEcho(label, spec.echo);
  return {
    width: spec.width,
    height: spec.height,
    label,
    fontSize: spec.fontSize,
    ...(sub ? { sub, subFontSize: spec.subFontSize } : {}),
    variant: id === "sortie" ? "primary" : "entrance",
    perspective: spec.perspective,
    tilt: spec.tilt,
    accentColor: spec.accent,
    accentTextColor: spec.accentText,
    motif: spec.motif,
  };
}
