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

/** 카드에 서는 SD — 렐릭 ID와 쪽. 신규는 파루아·도디가 좌우에서, 정규는 토리카 혼자 뛴다. */
export const ATTENDANCE_CAST: Readonly<Record<AttendanceTrackId, readonly { relicId: string; side: "left" | "right" }[]>> = {
  newcomer: [{ relicId: "parua", side: "left" }, { relicId: "dodo", side: "right" }],
  regular: [{ relicId: "torika", side: "left" }],
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
 * 출석 판 안 일곱 칸의 자리 — 3칸 두 줄 + 넓은 일곱째 띠.
 *
 * 칸마다 받는 것이 하나라 칸을 크게 세운다. 정규는 본 칸 아래에 **광고 덤 칸**(`ad`)이 한 장 더 붙는다 — 본 칸과
 * 같은 폭으로 붙여 「이 날의 덤」으로 읽히게 하고, 그만큼 칸이 길어진다. 칸 안의 자리(`main`·`ad`)는 칸 가운데가 0이다.
 */
export interface AttendanceSlotRect {
  day: number;
  x: number;
  y: number;
  width: number;
  height: number;
  main: { y: number; height: number };
  ad?: { y: number; height: number };
}

export const ATTENDANCE_PANEL = {
  width: 940,
  /** 제목표 아래 머리줄(진행·남은 기간)의 높이. */
  header: 124,
  /** 칸이 서는 안쪽 폭 — 세 칸과 두 틈이 이 폭을 채운다. */
  inner: 840,
  columns: 3,
  gap: 24,
  rowGap: 22,
  /** 본 칸의 높이와, 덤 칸의 높이·본 칸과의 틈. */
  mainHeight: 270,
  adHeight: 100,
  adGap: 10,
  bottomPad: 64,
} as const;

/** 판 높이와 일곱 칸의 자리(판 가운데가 0). `withAd`면 칸마다 덤 칸이 붙는다. */
export function attendancePanelLayout(withAd: boolean): { width: number; height: number; headerY: number; slots: AttendanceSlotRect[] } {
  const { width, header, inner, columns, gap, rowGap, mainHeight, adHeight, adGap, bottomPad } = ATTENDANCE_PANEL;
  const slotHeight = mainHeight + (withAd ? adGap + adHeight : 0);
  const rows = 3;
  const height = header + slotHeight * rows + rowGap * (rows - 1) + bottomPad;
  const cellWidth = (inner - gap * (columns - 1)) / columns;
  const left = -inner / 2;
  const top = -height / 2 + header;
  const parts = (): Pick<AttendanceSlotRect, "main" | "ad"> => ({
    main: { y: -slotHeight / 2 + mainHeight / 2, height: mainHeight },
    ...(withAd ? { ad: { y: slotHeight / 2 - adHeight / 2, height: adHeight } } : {}),
  });
  const slots: AttendanceSlotRect[] = [];
  for (let index = 0; index < 6; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    slots.push({
      day: index + 1,
      x: left + cellWidth / 2 + column * (cellWidth + gap),
      y: top + slotHeight / 2 + row * (slotHeight + rowGap),
      width: cellWidth, height: slotHeight, ...parts(),
    });
  }
  slots.push({ day: 7, x: 0, y: top + slotHeight / 2 + 2 * (slotHeight + rowGap), width: inner, height: slotHeight, ...parts() });
  return { width, height, headerY: -height / 2 + header / 2 + 22, slots };
}
