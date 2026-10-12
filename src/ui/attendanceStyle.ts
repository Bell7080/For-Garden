import type { AttendanceTrackId } from "../core/attendance";
import { BACKGROUND } from "./backgroundAssets";

/**
 * 출석 두 줄의 결과 자리 — Phaser 없이 읽히는 표다. 이벤트 카드와 출석 판이 같은 값을 읽는다.
 *
 * **신규는 노란빛, 정규는 푸른빛이다.** 카드는 다른 이벤트 카드와 같은 양식이고 색만 줄을 가른다.
 */
export const ATTENDANCE_TONE: Readonly<Record<AttendanceTrackId, { color: number; text: string; fill: number; deep: number; stroke: string }>> = {
  newcomer: { color: 0xf2cc4a, text: "#ffe07a", fill: 0x1d170a, deep: 0x6b4a08, stroke: "#2a1a02" },
  regular: { color: 0x6fa8d6, text: "#9fd0f0", fill: 0x0b131c, deep: 0x1d4566, stroke: "#06121e" },
};

/**
 * 출석에 서는 SD — 렐릭 ID와 쪽. 신규는 도디, 정규는 토리카가 혼자 뛴다. `side`는 출석 판 머리띠의 자리(정규는
 * 오른쪽 위에 시계가 서므로 왼쪽), `cardSide`는 이벤트 카드의 자리다(모든 이벤트 카드는 글이 왼쪽이라 오른쪽).
 */
export const ATTENDANCE_CAST: Readonly<Record<AttendanceTrackId, readonly { relicId: string; side: "left" | "right"; cardSide?: "left" | "right" }[]>> = {
  newcomer: [{ relicId: "dodo", side: "right" }],
  regular: [{ relicId: "torika", side: "left", cardSide: "right" }],
};

/**
 * 출석 카드의 뒷배경 원화 — 이벤트 카드 양식(`LobbyEventDef.backdropKey`·`backdropFrame`)과 같은 값이다.
 * 신규는 금빛 정비창, 정규는 토리카가 앉은 원화(토리카가 그 카드의 SD다).
 */
export const ATTENDANCE_CARD_ART: Readonly<Record<AttendanceTrackId, { key: string; frame: { zoom: number; offsetX: number; offsetY: number } }>> = {
  newcomer: { key: BACKGROUND.interactionRustWorks, frame: { zoom: 1, offsetX: 0, offsetY: 0 } },
  regular: { key: BACKGROUND.title, frame: { zoom: 1.22, offsetX: 90, offsetY: 200 } },
};

/**
 * 출석 판의 자리 — 위에 꾸민 머리띠(큰 제목 · 진행 · 남은 시간 · SD), 아래에 **왼쪽 3×2 + 오른쪽 일곱째**.
 *
 * 칸 판을 깔지 않고 **보상 액자 하나하나를 그대로 올려 둔다** — 판 안에 액자를 넣으면 액자가 두 겹으로 보이고
 * 받는 것보다 칸이 먼저 읽힌다. 일차는 액자 왼쪽 위 모서리에 걸친 이름표가, 덤은 아래 변에 걸린 광고 라벨이 말한다. 일곱째는 오른쪽 열에 한 뼘 크게,
 * 두 줄 사이 가운데 높이에 선다. 정규는 액자마다 아래에 **같은 크기의 광고 덤 액자**가 쌓인다.
 * 좌표는 판 가운데가 0이다.
 */
export interface AttendanceTileRect {
  day: number;
  x: number;
  /** 본 보상 액자의 가운데 높이와 한 변. */
  y: number;
  size: number;
  /** 광고 덤 액자의 가운데 높이(같은 한 변). 정규에만 있다. */
  adY?: number;
}

export interface AttendancePanelLayout {
  width: number;
  height: number;
  /** 꾸민 머리띠 — 가운데 높이와 폭·높이. */
  banner: { y: number; width: number; height: number };
  tiles: AttendanceTileRect[];
}

export const ATTENDANCE_PANEL = {
  width: 940,
  /** 머리띠와 격자가 서는 안쪽 폭. */
  inner: 840,
  /** 판 윗변에서 머리띠까지 — 제목표와 머리띠 위로 빠져나오는 SD 머리가 이 안에 든다. */
  bannerTop: 150,
  bannerHeight: 220,
  /** 머리띠 아래에서 첫 줄 액자 윗변까지 — 일차 이름표가 액자 윗변에 걸쳐 그만큼 솟는다. */
  gridGap: 64,
  /**
   * 액자 한 변(일곱째는 한 뼘 크다)과 본 액자·덤 액자 사이, 두 줄 사이. 본 액자와 덤 액자는 한 날의 묶음이라
   * 가까이 두고(덤의 광고 라벨은 일차 이름표처럼 왼쪽 위에 걸쳐 솟으므로 그만큼만 띄운다), 날과 날 사이는 넉넉히 띄워 묶음이 갈려 읽히게 한다.
   */
  tile: 148,
  finaleTile: 176,
  adGap: 32,
  rowGap: 92,
  bottomPad: 72,
} as const;

/** 판 높이와 머리띠·일곱 액자의 자리. `withAd`면 액자마다 덤 액자가 아래에 쌓인다. */
export function attendancePanelLayout(withAd: boolean): AttendancePanelLayout {
  const { width, inner, bannerTop, bannerHeight, gridGap, tile, finaleTile, adGap, rowGap, bottomPad } = ATTENDANCE_PANEL;
  const unit = (size: number): number => size + (withAd ? adGap + size : 0);
  const height = bannerTop + bannerHeight + gridGap + unit(tile) * 2 + rowGap + bottomPad;
  const top = -height / 2;
  const banner = { y: top + bannerTop + bannerHeight / 2, width: inner, height: bannerHeight };
  const gridTop = top + bannerTop + bannerHeight + gridGap;
  // 세 열과 일곱째 열이 안쪽 폭을 고르게 나눈다(틈 셋이 같다).
  const gap = (inner - tile * 3 - finaleTile) / 3;
  const left = -inner / 2;
  const tiles: AttendanceTileRect[] = [];
  for (let index = 0; index < 6; index += 1) {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const y = gridTop + tile / 2 + row * (unit(tile) + rowGap);
    tiles.push({ day: index + 1, x: left + tile / 2 + column * (tile + gap), y, size: tile, ...(withAd ? { adY: y + tile + adGap } : {}) });
  }
  // 일곱째 묶음(본 + 덤)의 가운데를 두 줄 묶음의 가운데 사이에 둔다.
  const middle = gridTop + (unit(tile) * 2 + rowGap) / 2;
  const finaleY = middle - unit(finaleTile) / 2 + finaleTile / 2;
  tiles.push({ day: 7, x: inner / 2 - finaleTile / 2, y: finaleY, size: finaleTile, ...(withAd ? { adY: finaleY + finaleTile + adGap } : {}) });
  return { width, height, banner, tiles };
}
