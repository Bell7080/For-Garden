import type { AttendanceTrackId } from "../core/attendance";

/**
 * 출석 두 줄의 결과 자리 — Phaser 없이 읽히는 표다. 이벤트 카드와 출석 판이 같은 값을 읽는다.
 *
 * **신규는 노란빛, 정규는 푸른빛이다.** 신규는 매일 들어오고 싶게 화려하게(둘이 좌우에서 뛰고 보상이 수북이
 * 쌓인다), 정규는 매일 받는 맛만 남기고 정돈된 결이다(혼자 뛰고 보상은 한 줄로 가지런하다).
 */
export const ATTENDANCE_TONE: Readonly<Record<AttendanceTrackId, { color: number; text: string; fill: number; deep: number; stroke: string }>> = {
  newcomer: { color: 0xf2cc4a, text: "#ffe07a", fill: 0x1d170a, deep: 0x6b4a08, stroke: "#2a1a02" },
  regular: { color: 0x6fa8d6, text: "#9fd0f0", fill: 0x0b131c, deep: 0x1d4566, stroke: "#06121e" },
};

/**
 * 출석에 서는 SD — 렐릭 ID와 쪽. 신규는 파루아·도디가 좌우에서, 정규는 토리카 혼자 뛴다. `side`는 출석 판 머리띠의
 * 자리(정규는 오른쪽 위에 시계가 서므로 왼쪽), `cardSide`는 이벤트 카드의 자리다(카드는 기간 이벤트와 같이 글이
 * 왼쪽이라 오른쪽).
 */
export const ATTENDANCE_CAST: Readonly<Record<AttendanceTrackId, readonly { relicId: string; side: "left" | "right"; cardSide?: "left" | "right" }[]>> = {
  newcomer: [{ relicId: "parua", side: "left" }, { relicId: "dodo", side: "right" }],
  regular: [{ relicId: "torika", side: "left", cardSide: "right" }],
};

/**
 * 신규 카드 가운데에 수북이 쌓이는 보상 더미 — 뒤에서 앞으로 그린다. 그림은 그 줄의 보상 가운데 중요한
 * 것부터 차례로 채운다(자리 수보다 보상 종류가 적으면 남는 자리는 비운다).
 */
export const ATTENDANCE_PILE: readonly { x: number; y: number; size: number; rotation: number }[] = [
  { x: -92, y: 4, size: 58, rotation: -0.22 },
  { x: 92, y: 4, size: 58, rotation: 0.22 },
  { x: 0, y: -8, size: 74, rotation: 0 },
  { x: -46, y: 22, size: 64, rotation: -0.1 },
  { x: 46, y: 22, size: 64, rotation: 0.12 },
];

/**
 * 더미 둘레에서 깜빡이는 네 갈래 반짝임 자리(더미 중심 기준). 난수 없이 번호에서 박자를 정한다. 더미와 반짝임은 위로는
 * 진행 줄, 아래로는 카드 밑변 안에 들도록 작게 모은다.
 */
export const ATTENDANCE_SPARKLES: readonly { x: number; y: number; size: number }[] = [
  { x: -126, y: -14, size: 14 }, { x: 128, y: -6, size: 13 }, { x: -58, y: -32, size: 11 }, { x: 66, y: -30, size: 15 }, { x: 0, y: 40, size: 10 },
];

/**
 * 출석 판의 자리 — 위에 꾸민 머리띠(큰 제목 · 진행 · 남은 시간 · SD), 아래에 **왼쪽 3×2 + 오른쪽 일곱째**.
 *
 * 칸 판을 깔지 않고 **보상 액자 하나하나를 그대로 올려 둔다** — 판 안에 액자를 넣으면 액자가 두 겹으로 보이고
 * 받는 것보다 칸이 먼저 읽힌다. 일차는 액자 왼쪽 위 모서리에 걸친 이름표가 말한다. 일곱째는 오른쪽 열에 한 뼘 크게,
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
  /** 액자 한 변(일곱째는 한 뼘 크다)과 본 액자·덤 액자 사이, 두 줄 사이. */
  tile: 168,
  finaleTile: 204,
  adGap: 32,
  rowGap: 64,
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
